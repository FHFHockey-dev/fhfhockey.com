import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayerPickupTable from "./PlayerPickupTable";

import {
  getNhlSeasonIdFromYahooSeasonYear,
  getYahooSeasonStartYear,
  normalizePickupPositions,
} from "./PlayerPickupTable";

describe("Player Pickup season identity", () => {
  it("keeps the Yahoo start year stable after the NHL season ends", () => {
    expect(getYahooSeasonStartYear(20252026)).toBe(2025);
    expect(getYahooSeasonStartYear("20252026")).toBe(2025);
    expect(getNhlSeasonIdFromYahooSeasonYear(2025)).toBe("20252026");
  });

  it("fails closed for missing or malformed season identities", () => {
    expect(getYahooSeasonStartYear(null)).toBeNull();
    expect(getYahooSeasonStartYear("2025")).toBeNull();
    expect(getYahooSeasonStartYear("2025-2026")).toBeNull();
  });
});

describe("pickup eligibility normalization", () => {
  it.each([
    [" c ", ["C"]],
    [["C", "LW", "C"], ["C", "LW"]],
    [[{ position: "C" }, { position: "LW" }], ["C", "LW"]],
    [{ position: "G" }, ["G"]],
    [null, []],
    [[{}, 42, { position: {} }, "unknown", "BN"], []],
  ])("validates eligibility %j", (input, expected) => {
    expect(normalizePickupPositions(input)).toEqual(expected);
  });
});


const state = vi.hoisted(() => ({ pro: false, fail: false, from: vi.fn(), access: { eligible: true }, rows: [] as Record<string, unknown>[] }));
vi.mock("hooks/useCurrentSeason", () => ({ useCurrentSeasonQuery: () => ({ data: { seasonId: 20262027 }, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("hooks/useProviderSyncAccess", () => ({ useProviderSyncAccess: () => ({ status: "ready", access: state.pro ? state.access : null, refresh: vi.fn() }) }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: { access_token: "test" } } }) } } }));
vi.mock("lib/supabase/public-client", () => ({ default: { from: state.from } }));
const rows = [
  { nhl_player_id: "1", nhl_player_name: "Free Agent", yahoo_player_id: "477.p.1", yahoo_team: "BOS", percent_ownership: 0, eligible_positions: [{ position: "C" }, { position: "LW" }] },
  { nhl_player_id: "2", nhl_player_name: "My Player", yahoo_player_id: "477.p.2", yahoo_team: "TOR", percent_ownership: 95, eligible_positions: ["C"] },
  { nhl_player_id: "3", nhl_player_name: "Other Player", yahoo_player_id: "477.p.3", yahoo_team: "BOS", percent_ownership: 10, eligible_positions: ["C"] },
];
beforeEach(() => {
  state.pro = false; state.fail = false;
  state.rows = rows.map(row => ({ ...row, ownership_timeline: [{ date: "2026-10-22", value: row.percent_ownership }] }));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  state.from.mockImplementation((table: string) => {
    const data = table === "yahoo_players" ? state.rows.map((row) => ({ player_key: row.yahoo_player_id, player_id: row.nhl_player_id, percent_ownership: row.percent_ownership }))
      : table === "yahoo_nhl_player_map_read" ? state.rows : [];
    const result = { data, error: state.fail && table === "yahoo_players" ? { message: "Unavailable" } : null };
    const builder: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) };
    for (const method of ["select", "eq", "range", "order", "in", "not", "limit", "gte", "lte", "maybeSingle"]) builder[method] = () => builder;
    return builder;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Player pickup interactions", () => {
  it("loads dated ownership from existing player rows and filters zero-owned players by team", async () => {
    render(React.createElement(PlayerPickupTable));
    expect(screen.getByRole("heading", { name: /^Best Players Available$/ }).textContent)
      .toBe("Best Players Available");
    await screen.findByText("F. Agent");
    expect(screen.getAllByText("C, LW").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
    expect(screen.getByText(/Availability in your league and waiver status are unknown/)).toBeTruthy();
    expect(state.from).toHaveBeenCalledWith("yahoo_players");
    expect(state.from).not.toHaveBeenCalledWith("yahoo_players_with_normalized_history");
    fireEvent.change(screen.getByLabelText("Team:"), { target: { value: "TOR" } });
    expect(screen.queryByText("F. Agent")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset Filters" }));
    expect(screen.getByText("F. Agent")).toBeTruthy();
  });
  it("retries a failed player request", async () => {
    state.fail = true;
    render(React.createElement(PlayerPickupTable));
    const retry = await screen.findByRole("button", { name: "Retry player data" });
    state.fail = false; fireEvent.click(retry);
    expect(await screen.findByText("F. Agent")).toBeTruthy();
  });
  it.each(["2026-09-17T12:00:00Z", "", "not-a-date"])("uses Yahoo non-rostered status with sync timestamp %s", async (fetchedAt) => {
    state.pro = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      leagueName: "Test league", teamName: "My team", gameKey: "477", season: 2026, fetchedAt,
      rosteredPlayerKeys: ["477.p.2", "477.p.3"], roster: [{ key: "477.p.2", name: "My Player", position: "C" }],
    } }) }));
    render(React.createElement(PlayerPickupTable));
    await screen.findByRole("button", { name: "My roster (1)" });
    if (fetchedAt === "2026-09-17T12:00:00Z") {
      expect(screen.getByText(`Test league · My team · Synced ${new Date(fetchedAt).toLocaleString()}`)).toBeTruthy();
    } else {
      expect(screen.getByText("Test league · My team · Sync time unavailable")).toBeTruthy();
      expect(screen.queryByText(/Invalid Date/)).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Non-rostered in my league" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Include unknown ownership" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Waiver status and immediate addability are unknown/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("F. Agent")).toBeTruthy());
    expect(screen.queryByText("O. Player")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "My roster (1)" }));
    expect(await screen.findByText("M. Player")).toBeTruthy();
    expect(screen.queryByText("F. Agent")).toBeNull();
  });
  it("discloses the general pool after Yahoo failure and allows refresh", async () => {
    state.pro = true;
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Yahoo sync is unavailable." }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {
        leagueName: "Test league", teamName: "My team", gameKey: "477", season: 2026, fetchedAt: "2026-09-17T12:00:00Z",
        rosteredPlayerKeys: ["477.p.2", "477.p.3"], roster: [],
      } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(React.createElement(PlayerPickupTable));
    await screen.findByText("Yahoo sync is unavailable.");
    expect(screen.getByText("Showing the general player pool; Yahoo league availability is not applied.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Non-rostered in my league" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Yahoo" }));
    await screen.findByRole("button", { name: "Non-rostered in my league" });
    expect(screen.queryByText("Yahoo sync is unavailable.")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("pickup ownership evidence", () => {
  it.each([null, undefined, "", "   ", false, "0x10", -1])("does not coerce missing or malformed season/row ownership into zero (%j)", async value => {
    state.rows = [{ ...rows[0], percent_ownership: value }];
    render(React.createElement(PlayerPickupTable));
    const name = await screen.findByText("F. Agent");
    const row = within(name.closest("tr")!);
    expect(row.getByText("Unknown")).toBeTruthy();
    expect(row.queryByRole("cell", { name: /^0%$/ })).toBeNull();
  });

  it.each([0, "0"])("preserves undated zero as last-known evidence, never a fresh measured zero (%j)", async value => {
    state.rows = [{ ...rows[0], percent_ownership: value }];
    render(React.createElement(PlayerPickupTable));
    const name = await screen.findByText("F. Agent");
    expect(within(name.closest("tr")!).getByText("Last known 0% · date unknown")).toBeTruthy();
  });

  it.each([1024, 390])("labels dated stale values and filters unknown separately at viewport %s", async width => {
    vi.stubGlobal("innerWidth", width);
    state.rows = [
      { ...rows[0], percent_ownership: 0, ownership_timeline: [{ date: "2026-10-22", value: "0" }] },
      { ...rows[2], percent_ownership: 20, ownership_timeline: JSON.stringify([{ date: "2026-10-18", value: 0 }, { date: "2026-10-22", value: "" }]) },
    ];
    render(React.createElement(PlayerPickupTable));
    const freshName = "F. Agent";
    const staleName = "O. Player";
    const name = await screen.findByText(freshName);
    expect(within(name.closest("tr")!).getByRole("cell", { name: /^0%$/ })).toBeTruthy();
    expect(screen.getByText("Last known 0% · 2026-10-18 (stale)")).toBeTruthy();
    const includeUnknown = screen.getByRole("checkbox", { name: "Include unknown ownership" }) as HTMLInputElement;
    expect(includeUnknown.checked).toBe(true);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
    expect(screen.getByText(staleName)).toBeTruthy();
    fireEvent.click(includeUnknown);
    expect(screen.queryByText(staleName)).toBeNull();
    expect(screen.getByText(freshName)).toBeTruthy();
    fireEvent.click(includeUnknown);
    expect(screen.getByText(staleName)).toBeTruthy();
  });
});

describe("mounted pickup ownership freshness", () => {
  const staleLabel = "Last known 0% · 2026-10-19 (stale)";

  async function mountBeforeExpiry(width = 1024) {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-21T23:59:59Z"));
    vi.stubGlobal("innerWidth", width);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    state.rows = [{ ...rows[0], percent_ownership: 0, ownership_timeline: [{ date: "2026-10-19", value: 0 }] }];
    await act(async () => { render(React.createElement(PlayerPickupTable)); });
    const name = screen.getByText("F. Agent");
    expect(within(name.closest("tr")!).getByRole("cell", { name: /^0%$/ })).toBeTruthy();
    return { reads: state.from.mock.calls.length, fetchMock, visibility };
  }

  it.each([1024, 390])("expires a mounted zero at the existing three-day boundary without fetching (viewport %s)", async width => {
    const { reads, fetchMock } = await mountBeforeExpiry(width);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText(staleLabel)).toBeNull();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(screen.getByText(staleLabel)).toBeTruthy();
    const includeUnknown = screen.getByRole("checkbox", { name: "Include unknown ownership" });
    fireEvent.click(includeUnknown);
    expect(screen.queryByText("F. Agent")).toBeNull();
    fireEvent.click(includeUnknown);
    expect(screen.getByText(staleLabel)).toBeTruthy();
    expect(state.from.mock.calls.length).toBe(reads);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["visibilitychange", "focus", "pageshow"])("rechecks retained evidence after hidden clock suspension on %s", async resumeEvent => {
    const { reads, fetchMock, visibility } = await mountBeforeExpiry();
    const includeUnknown = screen.getByRole("checkbox", { name: "Include unknown ownership" });
    fireEvent.click(includeUnknown);
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    // A suspended tab can miss its timeout; the resume event must use the current clock.
    vi.setSystemTime(new Date("2026-10-22T00:00:01Z"));
    visibility.mockReturnValue("visible");
    fireEvent(resumeEvent === "visibilitychange" ? document : window, new Event(resumeEvent));
    expect(screen.queryByText("F. Agent")).toBeNull();
    fireEvent.click(includeUnknown);
    expect(screen.getByText(staleLabel)).toBeTruthy();
    expect(state.from.mock.calls.length).toBe(reads);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechecks ownership during a filter interaction even when the expiry timeout has not run", async () => {
    const { reads, fetchMock } = await mountBeforeExpiry();
    vi.setSystemTime(new Date("2026-10-22T00:00:01Z"));
    const includeUnknown = screen.getByRole("checkbox", { name: "Include unknown ownership" });
    fireEvent.click(includeUnknown);
    expect(screen.queryByText("F. Agent")).toBeNull();
    fireEvent.click(includeUnknown);
    expect(screen.getByText(staleLabel)).toBeTruthy();
    expect(state.from.mock.calls.length).toBe(reads);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

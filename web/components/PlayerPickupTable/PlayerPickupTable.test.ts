import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayerPickupTable from "./PlayerPickupTable";

import {
  getNhlSeasonIdFromYahooSeasonYear,
  getYahooSeasonStartYear,
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


const state = vi.hoisted(() => ({ pro: false, fail: false, from: vi.fn(), access: { eligible: true } }));
vi.mock("hooks/useCurrentSeason", () => ({ useCurrentSeasonQuery: () => ({ data: { seasonId: 20262027 }, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("hooks/useDraftProAccess", () => ({ useDraftProAccess: () => ({ status: "ready", access: state.pro ? state.access : null }) }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: { access_token: "test" } } }) } } }));
vi.mock("lib/supabase/public-client", () => ({ default: { from: state.from } }));
const rows = [
  { nhl_player_id: "1", nhl_player_name: "Free Agent", yahoo_player_id: "477.p.1", yahoo_team: "BOS", percent_ownership: 0, eligible_positions: ["C"] },
  { nhl_player_id: "2", nhl_player_name: "My Player", yahoo_player_id: "477.p.2", yahoo_team: "TOR", percent_ownership: 95, eligible_positions: ["C"] },
  { nhl_player_id: "3", nhl_player_name: "Other Player", yahoo_player_id: "477.p.3", yahoo_team: "BOS", percent_ownership: 10, eligible_positions: ["C"] },
];
beforeEach(() => {
  state.pro = false; state.fail = false;
  state.from.mockImplementation((table: string) => {
    const data = table === "yahoo_players" ? rows.map((row) => ({ player_key: row.yahoo_player_id, player_id: row.nhl_player_id, percent_ownership: row.percent_ownership }))
      : table === "yahoo_nhl_player_map_read" ? rows : [];
    const result = { data, error: state.fail && table === "yahoo_players" ? { message: "Unavailable" } : null };
    const builder: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) };
    for (const method of ["select", "eq", "range", "order", "in", "not", "limit", "gte", "lte", "maybeSingle"]) builder[method] = () => builder;
    return builder;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Player pickup interactions", () => {
  it("loads current ownership without history and filters zero-owned players by team", async () => {
    render(React.createElement(PlayerPickupTable));
    await screen.findByText("F. Agent");
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
  it("uses Yahoo league availability and includes highly owned players in My roster", async () => {
    state.pro = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      leagueName: "Test league", teamName: "My team", gameKey: "477", season: 2026, fetchedAt: "2026-09-17T12:00:00Z",
      rosteredPlayerKeys: ["477.p.2", "477.p.3"], roster: [{ key: "477.p.2", name: "My Player", position: "C" }],
    } }) }));
    render(React.createElement(PlayerPickupTable));
    await screen.findByRole("button", { name: "My roster (1)" });
    await waitFor(() => expect(screen.getByText("F. Agent")).toBeTruthy());
    expect(screen.queryByText("O. Player")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "My roster (1)" }));
    expect(await screen.findByText("M. Player")).toBeTruthy();
    expect(screen.queryByText("F. Agent")).toBeNull();
  });
});

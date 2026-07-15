import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EspnImportPanel from "./EspnImportPanel";

const authGetSession = vi.hoisted(() => vi.fn());

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: { getSession: authGetSession },
  },
}));

const importedState = {
  account: { id: "account-espn", status: "connected" },
  leagues: [
    {
      id: "league-espn",
      external_league_key: "101",
      league_name: "Office Hockey",
      season_key: "2026",
    },
  ],
  teams: [
    {
      id: "team-espn-1",
      external_league_id: "league-espn",
      external_team_key: "1",
      team_name: "Breakaway Club",
    },
    {
      id: "team-espn-2",
      external_league_id: "league-espn",
      external_team_key: "2",
      team_name: "Five Hole",
    },
  ],
  preferences: {
    default_external_team_id: "team-espn-1",
    active_context: { external_team_id: "team-espn-1" },
  },
  latestRun: { status: "completed", cooldown_until: null },
};

describe("EspnImportPanel", () => {
  beforeEach(() => {
    authGetSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads ESPN leagues/teams and exposes active/default context controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => importedState,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<EspnImportPanel />);

    expect(await screen.findByText("Office Hockey")).toBeTruthy();
    expect(screen.getByText("Breakaway Club")).toBeTruthy();
    expect(screen.getByText("Five Hole")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Make Five Hole the default team",
      }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/account/espn/import",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
      }),
    );
  });

  it("switches active ESPN context in place without changing routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => importedState })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "ESPN active context updated." }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => importedState });
    vi.stubGlobal("fetch", fetchMock);

    render(<EspnImportPanel />);
    await screen.findByText("Office Hockey");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use Five Hole as active context",
      }),
    );

    expect(
      await screen.findByText("ESPN active context updated."),
    ).toBeTruthy();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/account/espn/import");
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "set_active_team",
          teamId: "team-espn-2",
        }),
      }),
    );
  });

  it("submits ESPN JSON and refreshes stored context", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Imported 1 ESPN team across 1 league.",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => importedState });
    vi.stubGlobal("fetch", fetchMock);

    render(<EspnImportPanel />);
    await screen.findByText(/No ESPN leagues have been imported/);

    fireEvent.change(screen.getByLabelText("ESPN import JSON"), {
      target: {
        value:
          '{"leagues":[{"name":"Office Hockey","teams":[{"name":"Breakaway Club"}]}]}',
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import ESPN Data" }));

    expect(
      await screen.findByText("Imported 1 ESPN team across 1 league."),
    ).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("keeps prior ESPN state visible when a retry is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => importedState })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "ESPN import is cooling down." }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<EspnImportPanel />);
    await screen.findByText("Office Hockey");
    fireEvent.change(screen.getByLabelText("ESPN import JSON"), {
      target: { value: '{"leagues":[]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import ESPN Data" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "ESPN import is cooling down.",
    );
    expect(screen.getByText("Office Hockey")).toBeTruthy();
  });
});

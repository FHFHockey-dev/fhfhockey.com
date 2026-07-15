import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FantraxImportPanel from "./FantraxImportPanel";

const authGetSession = vi.hoisted(() => vi.fn());

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: { getSession: authGetSession },
  },
}));

const importedState = {
  account: {
    id: "account-1",
    status: "connected",
  },
  leagues: [
    {
      id: "league-1",
      external_league_key: "l1",
      league_name: "Keeper League",
      season_key: "2026",
    },
  ],
  teams: [
    {
      id: "team-1",
      external_league_id: "league-1",
      external_team_key: "t1",
      team_name: "Puck Luck",
    },
    {
      id: "team-2",
      external_league_id: "league-1",
      external_team_key: "t2",
      team_name: "Ice Cats",
    },
  ],
  preferences: {
    default_external_team_id: "team-1",
    active_context: { external_team_id: "team-1" },
  },
  latestRun: { status: "completed", cooldown_until: null },
};

describe("FantraxImportPanel", () => {
  beforeEach(() => {
    authGetSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads multiple leagues/teams and exposes default-team controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => importedState,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FantraxImportPanel />);

    expect(await screen.findByText("Keeper League")).toBeTruthy();
    expect(screen.getByText("Puck Luck")).toBeTruthy();
    expect(screen.getByText("Ice Cats")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Make Ice Cats the default team",
      }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/account/fantrax/import",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
      }),
    );
  });

  it("submits pasted JSON and refreshes status after success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Imported 1 Fantrax team across 1 league.",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => importedState });
    vi.stubGlobal("fetch", fetchMock);

    render(<FantraxImportPanel />);
    await screen.findByText(/No Fantrax leagues have been imported/);

    fireEvent.change(screen.getByLabelText("Fantrax import JSON"), {
      target: {
        value: '{"leagues":[{"name":"Keeper","teams":[{"name":"Puck Luck"}]}]}',
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Import Fantrax Data" }),
    );

    expect(
      await screen.findByText("Imported 1 Fantrax team across 1 league."),
    ).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"format":"json"'),
      }),
    );
  });

  it("surfaces validation and cooldown failures without hiding prior state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => importedState })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Fantrax import is cooling down." }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<FantraxImportPanel />);
    await screen.findByText("Keeper League");
    fireEvent.change(screen.getByLabelText("Fantrax import JSON"), {
      target: { value: "league_name,team_name\nKeepers,Puck Luck" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Import Fantrax Data" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Fantrax import is cooling down.",
    );
    expect(screen.getByText("Keeper League")).toBeTruthy();
  });
});

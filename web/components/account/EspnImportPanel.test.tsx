import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EspnConnectionsResponse } from "lib/integrations/espn/contracts";

import EspnImportPanel from "./EspnImportPanel";

const authGetSession = vi.hoisted(() => vi.fn());

vi.mock("lib/supabase/client", () => ({
  default: { auth: { getSession: authGetSession } },
}));

const settings = {
  version: 1 as const,
  mappingVersion: "espn-fhl-v1" as const,
  externalLeagueKey: "fhl:2026:123456",
  espnLeagueId: "123456",
  leagueName: "Office Hockey",
  seasonKey: "2026",
  leagueType: "points" as const,
  scoringType: "H2H_POINTS",
  teamCount: 2,
  teams: [
    {
      externalTeamKey: "1",
      name: "Breakaway Club",
      abbreviation: "BRK",
      divisionId: 1,
      isOwned: true,
    },
    {
      externalTeamKey: "2",
      name: "Five Hole",
      abbreviation: "FIVE",
      divisionId: 1,
      isOwned: false,
    },
  ],
  skaterScoringCategories: { GOALS: 3, ASSISTS: 2 },
  goalieScoringCategories: { WINS_GOALIE: 4 },
  categoryWeights: {},
  rosterConfig: { C: 1, LW: 1, RW: 1, D: 2, G: 1, bench: 3 },
  draftOrderType: "snake" as const,
  draftOrder: ["1", "2"],
  draftType: "SNAKE",
  liveDraftSupported: true,
  sourceHash: "a".repeat(64),
  fetchedAt: "2026-08-14T12:00:00.000Z",
  diagnostics: { status: "supported" as const, warnings: [], unsupported: [] },
};

const connectionState: EspnConnectionsResponse = {
  apiEnabled: true,
  liveDraftEnabled: true,
  defaultExternalLeagueId: "league-espn",
  defaultExternalTeamId: "team-espn-1",
  accounts: [
    {
      id: "account-espn",
      label: "My ESPN account",
      status: "connected",
      lastSyncedAt: "2026-08-14T12:00:00.000Z",
      leagues: [
        {
          id: "league-espn",
          connectedAccountId: "account-espn",
          externalLeagueKey: "fhl:2026:123456",
          espnLeagueId: "123456",
          name: "Office Hockey",
          seasonKey: "2026",
          importedAt: "2026-08-14T12:00:00.000Z",
          settings,
          teams: [
            { ...settings.teams[0], id: "team-espn-1" },
            { ...settings.teams[1], id: "team-espn-2" },
          ],
          isDefault: true,
          settingsChanged: false,
          syncStatus: "completed",
          syncErrorCode: null,
        },
      ],
    },
  ],
};

const manualState = {
  account: null,
  leagues: [],
  teams: [],
  preferences: null,
  latestRun: null,
};

function json(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function installFetch(
  handler?: (path: string, init: RequestInit | undefined) => Promise<Response | null>,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const handled = await handler?.(path, init);
    if (handled) return handled;
    if (path === "/api/v1/account/espn/connections") {
      return json(connectionState);
    }
    if (path === "/api/v1/account/espn/import") return json(manualState);
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("EspnImportPanel", () => {
  beforeEach(() => {
    authGetSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows sanitized linked state, mappings, and masked credential controls", async () => {
    const fetchMock = installFetch();

    render(<EspnImportPanel />);

    expect(await screen.findByText("Office Hockey")).toBeTruthy();
    expect(screen.getByText("Breakaway Club (owned)")).toBeTruthy();
    expect(screen.getByText("Account default")).toBeTruthy();
    expect(screen.getByText("Ordered draft supported")).toBeTruthy();
    expect(screen.getByLabelText("SWID").getAttribute("type")).toBe("password");
    expect(screen.getByLabelText(/^espn_s2/).getAttribute("type")).toBe("password");
    expect(screen.queryByText("redacted-session-secret")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/account/espn/connections",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
      }),
    );
  });

  it("requires explicit consent and links a league-season without a password", async () => {
    let linked = false;
    const fetchMock = installFetch(async (path) => {
      if (path === "/api/v1/account/espn/connections") {
        return json(linked ? connectionState : { ...connectionState, accounts: [] });
      }
      if (path === "/api/v1/account/espn/link") {
        linked = true;
        return json({ accountId: "account-espn", externalLeagueId: "league-espn" });
      }
      return null;
    });
    render(<EspnImportPanel />);
    await screen.findByText("0 linked");

    fireEvent.change(screen.getByLabelText("SWID"), {
      target: { value: "{00000000-0000-0000-0000-000000000001}" },
    });
    fireEvent.change(screen.getByLabelText(/^espn_s2/), {
      target: { value: "redacted-session-secret" },
    });
    fireEvent.change(screen.getByLabelText("League ID or ESPN league URL"), {
      target: { value: "https://fantasy.espn.com/hockey/league?leagueId=123456" },
    });
    fireEvent.change(screen.getByLabelText("Season"), {
      target: { value: "2026" },
    });
    const submit = screen.getByRole("button", { name: "Validate and link" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByLabelText(/I consent to FHFH storing these ESPN session values/),
    );
    fireEvent.click(submit);

    expect(
      await screen.findByText("ESPN account linked. Defaults were not changed."),
    ).toBeTruthy();
    const linkCall = fetchMock.mock.calls.find(
      ([path]) => path === "/api/v1/account/espn/link",
    );
    expect(linkCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          accountLabel: "My ESPN account",
          swid: "{00000000-0000-0000-0000-000000000001}",
          espnS2: "redacted-session-secret",
          leagueRef: "https://fantasy.espn.com/hockey/league?leagueId=123456",
          season: "2026",
          consentVersion: "espn-fantasy-private-beta-v1",
        }),
      }),
    );
    expect(screen.queryByLabelText(/ESPN password/i)).toBeNull();
  });

  it("requires acknowledgment for partial mappings and flags changed settings", async () => {
    const partialState = structuredClone(connectionState);
    partialState.accounts[0].leagues[0].isDefault = false;
    partialState.accounts[0].leagues[0].settingsChanged = true;
    partialState.accounts[0].leagues[0].settings.diagnostics = {
      status: "partial",
      warnings: [],
      unsupported: [
        {
          kind: "roster",
          code: "12",
          label: "ESPN lineup slot 12",
          reason: "This active lineup slot is unsupported.",
        },
      ],
    };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = installFetch(async (path) => {
      if (path === "/api/v1/account/espn/connections") return json(partialState);
      if (path === "/api/v1/account/espn/apply-settings") return json({});
      return null;
    });

    render(<EspnImportPanel />);
    expect(
      await screen.findByText("Updated league settings available"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply as account default" }),
    );

    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    const applyCall = fetchMock.mock.calls.find(
      ([path]) => path === "/api/v1/account/espn/apply-settings",
    );
    expect(JSON.parse(String(applyCall?.[1]?.body))).toMatchObject({
      externalLeagueId: "league-espn",
      externalTeamId: "team-espn-1",
      settingsHash: "a".repeat(64),
      acknowledgeWarnings: true,
    });
  });

  it("keeps the existing manual CSV/JSON import as a separate fallback", async () => {
    let manualImported = false;
    const fetchMock = installFetch(async (path, init) => {
      if (path === "/api/v1/account/espn/connections") {
        return json({ ...connectionState, apiEnabled: false, accounts: [] });
      }
      if (path === "/api/v1/account/espn/import" && init?.method === "POST") {
        manualImported = true;
        return json({ message: "Imported 1 ESPN team across 1 league." });
      }
      if (path === "/api/v1/account/espn/import") {
        return json(manualImported ? { ...manualState, account: { id: "manual" } } : manualState);
      }
      return null;
    });

    render(<EspnImportPanel />);
    expect(
      await screen.findByText(/ESPN API linking is off for this account/),
    ).toBeTruthy();
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
    expect(
      fetchMock.mock.calls.some(
        ([path, init]) =>
          path === "/api/v1/account/espn/import" && init?.method === "POST",
      ),
    ).toBe(true);
  });
});

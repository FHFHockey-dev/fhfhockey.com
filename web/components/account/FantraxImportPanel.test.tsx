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

const normalizedSettings = {
  version: 1 as const,
  mappingVersion: "fantrax-nhl-v1" as const,
  externalLeagueKey: "league-key-1",
  leagueName: "Keeper League",
  seasonKey: "2026",
  leagueType: "points" as const,
  teamCount: 12,
  teams: [
    {
      externalTeamKey: "team-key-1",
      name: "Puck Luck",
      division: null,
      isOwned: true,
    },
  ],
  skaterScoringCategories: { GOALS: 3 },
  goalieScoringCategories: { WINS_GOALIE: 4 },
  categoryWeights: {},
  rosterConfig: { C: 2, G: 2, bench: 4 },
  draftOrderType: "snake" as const,
  sourceHash: "settings-hash-1",
  fetchedAt: "2026-08-14T12:00:00.000Z",
  diagnostics: {
    status: "supported" as const,
    warnings: [] as string[],
    unsupported: [],
  },
};

const connectionState = {
  apiEnabled: true,
  accounts: [
    {
      id: "account-1",
      label: "Primary Fantrax",
      status: "connected",
      lastSyncedAt: "2026-08-14T12:00:00.000Z",
      integrationModes: ["api"],
      leagues: [
        {
          id: "league-row-1",
          connectedAccountId: "account-1",
          externalLeagueKey: "league-key-1",
          name: "Keeper League",
          seasonKey: "2026",
          importedAt: "2026-08-14T12:00:00.000Z",
          settings: normalizedSettings,
          teams: [
            {
              id: "team-row-1",
              externalTeamKey: "team-key-1",
              name: "Puck Luck",
              division: null,
              isOwned: true,
            },
          ],
          isDefault: true,
          settingsChanged: false,
        },
      ],
    },
  ],
  defaultExternalLeagueId: "league-row-1",
  defaultExternalTeamId: "team-row-1",
};

const manualState = {
  account: { id: "account-1", status: "connected" },
  accounts: [
    { id: "account-1", account_label: "Primary Fantrax", status: "connected" },
  ],
  leagues: [
    {
      id: "league-row-1",
      external_league_key: "league-key-1",
      league_name: "Keeper League",
      season_key: "2026",
    },
  ],
  teams: [
    {
      id: "team-row-1",
      external_league_id: "league-row-1",
      external_team_key: "team-key-1",
      team_name: "Puck Luck",
    },
  ],
  preferences: {
    default_external_team_id: "team-row-1",
    active_context: { external_team_id: "team-row-1" },
  },
  latestRun: { status: "completed", cooldown_until: null },
};

function response(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body });
}

describe("FantraxImportPanel", () => {
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

  it("shows linked identities, owned teams, settings, freshness, and defaults", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/connections")) return response(connectionState);
      if (path.endsWith("/import")) return response(manualState);
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FantraxImportPanel />);

    expect((await screen.findAllByText("Primary Fantrax")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Keeper League").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Puck Luck").length).toBeGreaterThan(0);
    expect(screen.getByText("Account default")).toBeTruthy();
    expect(screen.getByText(/GOALS: 3/)).toBeTruthy();
    expect(screen.getByText(/WINS_GOALIE: 4/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage leagues" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/account/fantrax/connections",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("discovers with all leagues unchecked, previews, records consent, and links explicitly", async () => {
    const discoveredLeague = {
      externalLeagueKey: "league-key-1",
      name: "Keeper League",
      sport: "NHL",
      ownedTeams: normalizedSettings.teams,
    };
    const emptyConnections = { ...connectionState, accounts: [] };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith("/connections")) return response(emptyConnections);
      if (path.endsWith("/import")) {
        return response({ ...manualState, account: null, accounts: [], leagues: [], teams: [] });
      }
      if (path.endsWith("/discover")) {
        const body = JSON.parse(String(init?.body));
        return response({
          leagues: [discoveredLeague],
          previews: body.selectedLeagueKeys ? [normalizedSettings] : [],
        });
      }
      if (path.endsWith("/link")) return response({ success: true, accountId: "account-1" });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FantraxImportPanel />);
    await screen.findByText("Add Fantrax account");
    fireEvent.change(screen.getByLabelText(/Fantrax Secret ID/), {
      target: { value: "secret-id" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Discover NHL leagues" }));

    const leagueCheckbox = await screen.findByRole("checkbox", {
      name: /Keeper League/,
    });
    expect((leagueCheckbox as HTMLInputElement).checked).toBe(false);
    fireEvent.click(leagueCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Preview mappings" }));

    const consent = await screen.findByRole("checkbox", {
      name: /I consent to FHFH storing this Secret ID/,
    });
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole("button", { name: "Confirm and link" }));

    expect(
      await screen.findByText("Fantrax account linked. Defaults were not changed."),
    ).toBeTruthy();
    const linkCall = fetchMock.mock.calls.find(([path]) =>
      String(path).endsWith("/link"),
    );
    expect(JSON.parse(String(linkCall?.[1]?.body))).toMatchObject({
      secretId: "secret-id",
      selectedLeagueKeys: ["league-key-1"],
      consentVersion: "fantrax-settings-v1",
    });
  });

  it("requires confirmation for every omitted partial mapping before Apply", async () => {
    const partialSettings = {
      ...normalizedSettings,
      diagnostics: {
        status: "partial" as const,
        warnings: ["Draft format needs review."],
        unsupported: [
          {
            kind: "roster" as const,
            code: "IR",
            label: "Injured reserve",
            reason: "No exact FHFH equivalent.",
          },
        ],
      },
    };
    const partialState = {
      ...connectionState,
      accounts: connectionState.accounts.map((account) => ({
        ...account,
        leagues: account.leagues.map((league) => ({
          ...league,
          settings: partialSettings,
        })),
      })),
    };
    const appliedSettings = {
      league_type: "points",
      scoring_categories: { GOALS: 3 },
      goalie_scoring_categories: { WINS_GOALIE: 4 },
      category_weights: {},
      roster_config: { C: 2, G: 2, bench: 4 },
      team_count: 12,
      draft_order_type: "snake",
      ui_preferences: {},
      active_context: {},
    };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onSettingsApplied = vi.fn();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith("/connections")) return response(partialState);
      if (path.endsWith("/import")) return response(manualState);
      if (path.endsWith("/apply-settings")) {
        return response({ success: true, settings: appliedSettings });
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FantraxImportPanel onSettingsApplied={onSettingsApplied} />);
    const apply = await screen.findByRole("button", {
      name: "Apply as account default",
    });
    fireEvent.click(apply);

    await waitFor(() => expect(onSettingsApplied).toHaveBeenCalledOnce());
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Injured reserve"));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Draft format"));
    const applyCall = fetchMock.mock.calls.find(([path]) =>
      String(path).endsWith("/apply-settings"),
    );
    expect(JSON.parse(String(applyCall?.[1]?.body))).toMatchObject({
      externalLeagueId: "league-row-1",
      externalTeamId: "team-row-1",
      settingsHash: "settings-hash-1",
      acknowledgeWarnings: true,
    });
  });

  it("keeps CSV/JSON import under Advanced and requires an account target", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith("/connections")) return response(connectionState);
      if (path.endsWith("/import") && init?.method === "POST") {
        return response({ message: "Imported 1 Fantrax team across 1 league." });
      }
      if (path.endsWith("/import")) return response(manualState);
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FantraxImportPanel />);
    fireEvent.click(await screen.findByText("Advanced: CSV/JSON import"));
    fireEvent.change(screen.getByLabelText("Import into account"), {
      target: { value: "account-1" },
    });
    fireEvent.change(screen.getByLabelText("Fantrax import JSON"), {
      target: { value: '{"leagues":[]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Fantrax Data" }));

    expect(
      await screen.findByText("Imported 1 Fantrax team across 1 league."),
    ).toBeTruthy();
    const importCall = fetchMock.mock.calls.find(
      ([path, init]) =>
        String(path).endsWith("/import") && init?.method === "POST",
    );
    expect(JSON.parse(String(importCall?.[1]?.body))).toMatchObject({
      targetConnectedAccountId: "account-1",
    });
  });
});

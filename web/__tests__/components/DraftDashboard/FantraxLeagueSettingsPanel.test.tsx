import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useFantraxConnections = vi.hoisted(() => vi.fn());

vi.mock("hooks/useFantraxConnections", () => ({ useFantraxConnections }));

import FantraxLeagueSettingsPanel from "../../../components/DraftDashboard/FantraxLeagueSettingsPanel";
import type { FantraxConnectionLeague } from "lib/integrations/fantrax/contracts";

const settings = {
  version: 1 as const,
  mappingVersion: "fantrax-nhl-v1" as const,
  externalLeagueKey: "league-key-1",
  leagueName: "Keeper League",
  seasonKey: "2026",
  leagueType: "points" as const,
  teamCount: 14,
  teams: [],
  skaterScoringCategories: { GOALS: 3 },
  goalieScoringCategories: { WINS_GOALIE: 4 },
  categoryWeights: {},
  rosterConfig: { C: 2, G: 2 },
  draftOrderType: "snake" as const,
  sourceHash: "hash-1",
  fetchedAt: "2026-08-14T12:00:00.000Z",
  diagnostics: {
    status: "supported" as const,
    warnings: [] as string[],
    unsupported: [],
  },
};

const league = {
  id: "league-row-1",
  connectedAccountId: "account-1",
  externalLeagueKey: "league-key-1",
  name: "Keeper League",
  seasonKey: "2026",
  importedAt: "2026-08-14T12:00:00.000Z",
  settings,
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
};

function hookData(nextLeague: FantraxConnectionLeague = league) {
  return {
    data: {
      apiEnabled: true,
      accounts: [
        {
          id: "account-1",
          label: "Primary Fantrax",
          status: "connected",
          lastSyncedAt: "2026-08-14T12:00:00.000Z",
          integrationModes: ["api"],
          leagues: [nextLeague],
        },
      ],
      defaultExternalLeagueId: "league-row-1",
      defaultExternalTeamId: "team-row-1",
    },
    isLoading: false,
    error: null,
    reload: vi.fn(),
  };
}

describe("Draft Dashboard Fantrax settings picker", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("defaults to the account league/team and applies only a session selection", async () => {
    useFantraxConnections.mockReturnValue(hookData());
    const onApply = vi.fn();
    render(
      <FantraxLeagueSettingsPanel
        enabled
        disabled={false}
        onApply={onApply}
      />,
    );

    await waitFor(() => {
      expect((screen.getByLabelText("Linked account") as HTMLSelectElement).value)
        .toBe("account-1");
    });
    expect((screen.getByLabelText("League") as HTMLSelectElement).value).toBe(
      "league-row-1",
    );
    expect((screen.getByLabelText("Owned team") as HTMLSelectElement).value).toBe(
      "team-row-1",
    );
    expect(screen.getByText(/points · 2 scoring mappings · 14 teams/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Apply to this draft" }));
    expect(onApply).toHaveBeenCalledWith(league, "team-row-1", {
      connectedAccountId: "account-1",
      externalLeagueId: "league-row-1",
      externalTeamId: "team-row-1",
      settingsHash: "hash-1",
    });
  });

  it("requires partial-warning confirmation and disables application in Yahoo mode", async () => {
    const partialLeague = {
      ...league,
      settings: {
        ...settings,
        diagnostics: {
          status: "partial" as const,
          warnings: ["Draft format omitted."],
          unsupported: [
            {
              kind: "roster" as const,
              code: "IR",
              label: "Injured reserve",
              reason: "No exact mapping.",
            },
          ],
        },
      },
    };
    useFantraxConnections.mockReturnValue(hookData(partialLeague));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onApply = vi.fn();
    const { rerender } = render(
      <FantraxLeagueSettingsPanel
        enabled
        disabled={false}
        onApply={onApply}
      />,
    );
    await screen.findByText("Injured reserve (IR): No exact mapping.");
    fireEvent.click(screen.getByRole("button", { name: "Apply to this draft" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Draft format omitted"));

    rerender(
      <FantraxLeagueSettingsPanel enabled disabled onApply={onApply} />,
    );
    expect(screen.getByText(/Yahoo live draft sync is authoritative/)).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Apply to this draft",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

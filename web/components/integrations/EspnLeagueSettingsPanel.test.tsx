import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EspnConnectionsResponse } from "lib/integrations/espn/contracts";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  reload: vi.fn(async () => undefined),
}));

const response: EspnConnectionsResponse = {
  apiEnabled: true,
  liveDraftEnabled: false,
  defaultExternalLeagueId: null,
  defaultExternalTeamId: null,
  accounts: [
    {
      id: "account-1",
      label: "ESPN account",
      status: "connected",
      lastSyncedAt: "2026-08-15T00:00:00.000Z",
      leagues: [
        {
          id: "league-1",
          connectedAccountId: "account-1",
          externalLeagueKey: "fhl:2026:123456",
          espnLeagueId: "123456",
          name: "Test League",
          seasonKey: "2026",
          importedAt: "2026-08-15T00:00:00.000Z",
          settings: {
            version: 1,
            mappingVersion: "espn-fhl-v1",
            externalLeagueKey: "fhl:2026:123456",
            espnLeagueId: "123456",
            leagueName: "Test League",
            seasonKey: "2026",
            leagueType: "points",
            scoringType: "H2H_POINTS",
            teamCount: 2,
            teams: [],
            skaterScoringCategories: { GOALS: 3 },
            goalieScoringCategories: { WINS_GOALIE: 4 },
            categoryWeights: {},
            rosterConfig: { C: 1, G: 1 },
            draftOrderType: "snake",
            draftOrder: ["1", "2"],
            draftType: "SNAKE",
            liveDraftSupported: true,
            sourceHash: "a".repeat(64),
            fetchedAt: "2026-08-15T00:00:00.000Z",
            diagnostics: { status: "supported", warnings: [], unsupported: [] },
          },
          teams: [],
          isDefault: false,
          settingsChanged: false,
          syncStatus: "completed",
          syncErrorCode: null,
        },
      ],
    },
  ],
};

vi.mock("hooks/useEspnConnections", () => ({
  espnAccountRequest: mocks.request,
  useEspnConnections: () => ({
    data: response,
    isLoading: false,
    error: null,
    reload: mocks.reload,
  }),
}));

import EspnLeagueSettingsPanel from "./EspnLeagueSettingsPanel";

describe("EspnLeagueSettingsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("confirms a conflicting replacement before writing an account default", async () => {
    const onApply = vi.fn();
    const onConfirmApply = vi.fn(() => false);
    render(
      <EspnLeagueSettingsPanel
        enabled
        disabled={false}
        contextLabel="projection session"
        onApply={onApply}
        onConfirmApply={onConfirmApply}
      />,
    );

    await screen.findByText("Exact supported hockey mapping.");
    fireEvent.click(screen.getByRole("button", { name: "Make account default" }));

    expect(onConfirmApply).toHaveBeenCalledWith(
      expect.objectContaining({ id: "league-1" }),
      expect.objectContaining({ externalLeagueId: "league-1" }),
    );
    expect(mocks.request).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});

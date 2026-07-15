import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DraftBoard from "../../../components/DraftDashboard/DraftBoard";
import DraftSettings from "../../../components/DraftDashboard/DraftSettings";
import type { DraftSettings as DraftSettingsContract } from "../../../components/DraftDashboard/DraftDashboard";
import { KEEPER_CONTRACT_VERSION } from "../../../lib/draftDashboard/keepers";

vi.mock("lib/supabase", () => ({ default: {} }));
vi.mock("components/PlayerAutocomplete", () => ({
  default: () => <input aria-label="Keeper player" />
}));

const settings: DraftSettingsContract = {
  teamCount: 2,
  draftOrder: ["Team 1", "Team 2"],
  scoringCategories: {},
  rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0, bench: 0 },
  isKeeper: true
};

const keeper = {
  version: KEEPER_CONTRACT_VERSION,
  status: "valid" as const,
  playerId: "1",
  teamId: "Team 2",
  round: 1,
  pickInRound: 1,
  pickNumber: 1
};

const player = {
  playerId: 1,
  fullName: "Keeper Player",
  displayTeam: "TST",
  displayPosition: "C",
  combinedStats: {},
  fantasyPoints: {
    projected: 100,
    actual: null,
    diffPercentage: null,
    projectedPerGame: null,
    actualPerGame: null
  }
} as any;

afterEach(cleanup);

describe("keeper workflow surfaces", () => {
  it("attributes a forfeited Draft Board pick to the keeper team", () => {
    const view = render(
      <DraftBoard
        draftSettings={settings}
        draftedPlayers={[
          {
            playerId: "1",
            teamId: "Team 2",
            round: 1,
            pickInRound: 1,
            pickNumber: 1,
            isKeeper: true,
            keeperVersion: KEEPER_CONTRACT_VERSION
          }
        ]}
        currentTurn={{
          round: 1,
          pickInRound: 2,
          teamId: "Team 2",
          isMyTurn: false
        }}
        teamStats={[
          { teamId: "Team 1", teamName: "Team 1", owner: "", projectedPoints: 0, categoryTotals: {}, rosterSlots: {}, bench: [], teamVorp: 0 },
          { teamId: "Team 2", teamName: "Team 2", owner: "", projectedPoints: 100, categoryTotals: {}, rosterSlots: { C: [] }, bench: [], teamVorp: 0 }
        ]}
        isSnakeDraft
        allPlayers={[player]}
        onUpdateTeamName={vi.fn()}
        keepers={[keeper]}
        pickTrades={[
          {
            version: 1,
            status: "valid",
            round: 1,
            pickInRound: 2,
            pickNumber: 2,
            originalTeamId: "Team 2",
            currentTeamId: "Team 1"
          }
        ]}
      />
    );

    const cell = view.container.querySelector(
      '[data-round="1"][data-pick="1"]'
    );
    expect(cell?.getAttribute("data-owner")).toBe("Team 2");
    expect(cell?.getAttribute("title")).toContain("Keeper: Team 2");
    expect(screen.getByLabelText("Keeper")).toBeTruthy();
    expect(
      view.container
        .querySelector('[data-round="1"][data-pick="2"]')
        ?.getAttribute("data-owner")
    ).toBe("Team 1");
  });

  it("offers bulk keeper input and reports transactional validation errors", () => {
    const onImportKeepers = vi.fn(() => ({
      ok: false,
      message: "Row 2: Player is already configured as a keeper."
    }));
    render(
      <DraftSettings
        settings={settings}
        onSettingsChange={vi.fn()}
        isSnakeDraft
        onSnakeDraftChange={vi.fn()}
        myTeamId="Team 1"
        onMyTeamIdChange={vi.fn()}
        undoLastPick={vi.fn()}
        resetDraft={vi.fn()}
        draftHistory={[]}
        draftedPlayers={[]}
        currentPick={1}
        keepers={[]}
        onImportKeepers={onImportKeepers}
        playersForKeeperAutocomplete={[
          { id: 1, fullName: "Keeper Player" }
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Bulk keepers/), {
      target: {
        value:
          "playerId,teamId,round,pickInRound\n1,Team 1,1,1\n1,Team 2,1,2"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Keepers" }));

    expect(onImportKeepers).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("Row 2");
  });
});

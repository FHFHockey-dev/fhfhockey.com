import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  cost: "pick" as const,
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
  it("opens the draft graph as a keyboard modal and restores focus on Escape", () => {
    const priorFocus = document.createElement("button");
    document.body.appendChild(priorFocus);
    priorFocus.focus();
    render(<DraftBoard draftSettings={settings} draftedPlayers={[]} currentTurn={{ round: 1, pickInRound: 1, teamId: "Team 1", isMyTurn: true }} teamStats={[]} allPlayers={[player]} onUpdateTeamName={vi.fn()} />);
    expect(document.activeElement).toBe(priorFocus);
    const open = screen.getByRole("button", { name: "Expand draft graph" });
    open.focus();
    fireEvent.keyDown(open, { key: "Enter" });
    fireEvent.click(open);
    expect(screen.getByRole("dialog", { name: "Draft Graph" })).toBeTruthy();
    const close = screen.getByRole("button", { name: "Close expanded graph" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Team 2" }));
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Draft Graph" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Expand draft graph" }));
    priorFocus.remove();
  });

  it("retains value intensities and the user's row across completed picks", () => {
    const players = [10, 35, 60, 100].map((value, index) => ({ ...player, playerId: index + 1, fantasyPoints: { ...player.fantasyPoints, projected: value } }));
    const view = render(<DraftBoard myTeamId="Team 2" draftSettings={{ ...settings, rosterConfig: { C: 2, bench: 0, utility: 0 } }} draftedPlayers={players.map((item, index) => ({ playerId: String(item.playerId), teamId: index % 2 ? "Team 2" : "Team 1", round: Math.floor(index / 2) + 1, pickInRound: index % 2 + 1, pickNumber: index + 1 }))} currentTurn={{ round: 3, pickInRound: 1, teamId: "Team 1", isMyTurn: false }} teamStats={[]} allPlayers={players} onUpdateTeamName={vi.fn()} />);
    expect(Array.from(view.container.querySelectorAll("[data-intensity]")).map((cell) => cell.getAttribute("data-intensity")).sort()).toEqual(["1", "2", "3", "4"]);
    expect(view.container.querySelector('[data-my-team="true"]')?.textContent).toContain("Team 2 (You)");
  });
  it("shows unresolved Fantrax selections and their provider owner on the graph", () => {
    const view = render(<DraftBoard
      draftSettings={settings}
      draftedPlayers={[{ playerId: "-2000001", teamId: "Team 2", round: 1, pickInRound: 1,
        pickNumber: 1, source: "fantrax", fantraxDisplayName: "Noah Dobson", fantraxMappingStatus: "unresolved" }]}
      currentTurn={{ round: 1, pickInRound: 2, teamId: "Team 1", isMyTurn: false }}
      teamStats={[]} allPlayers={[]} onUpdateTeamName={vi.fn()}
      providerPickOwnerByNumber={{ 1: "Team 2", 2: "Team 1" }}
    />);
    const pick = view.container.querySelector('[data-overall-pick="1"]');
    expect(pick?.getAttribute("data-owner")).toBe("Team 2");
    expect(pick?.getAttribute("title")).toContain("Noah Dobson");
    expect(pick?.getAttribute("title")).toContain("Fantrax owner: Team 2");
    expect(pick?.textContent).toContain("?");
    expect(screen.getByText("Fantrax pick needs review")).toBeTruthy();
  });
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
    expect(cell?.getAttribute("role")).toBe("img");
    expect(cell?.getAttribute("aria-label")).toContain("Keeper: Team 2");
    expect(screen.getByLabelText("Keeper")).toBeTruthy();
    expect(
      view.container
        .querySelector('[data-round="1"][data-pick="2"]')
        ?.getAttribute("data-owner")
    ).toBe("Team 1");
  });

  it("shows no-pick keepers separately and marks roster-full board skips", () => {
    const noPickKeeper = {
      version: KEEPER_CONTRACT_VERSION,
      status: "valid" as const,
      cost: "none" as const,
      playerId: "1",
      teamId: "Team 1",
    };
    const view = render(
      <DraftBoard
        draftSettings={settings}
        draftedPlayers={[]}
        currentTurn={{
          round: 1,
          pickInRound: 2,
          teamId: "Team 2",
          isMyTurn: false,
        }}
        teamStats={[
          {
            teamId: "Team 1",
            teamName: "Team 1",
            owner: "",
            projectedPoints: 100,
            categoryTotals: {},
            rosterSlots: {
              C: [
                {
                  playerId: "1",
                  teamId: "Team 1",
                  isKeeper: true,
                  keeperCost: "none",
                },
              ],
            },
            bench: [],
            teamVorp: 0,
          },
          {
            teamId: "Team 2",
            teamName: "Team 2",
            owner: "",
            projectedPoints: 0,
            categoryTotals: {},
            rosterSlots: { C: [] },
            bench: [],
            teamVorp: 0,
          },
        ]}
        draftOrderPattern={{ mode: "standard", reversedRounds: [] }}
        allPlayers={[player]}
        onUpdateTeamName={vi.fn()}
        keepers={[noPickKeeper]}
      />,
    );

    expect(screen.getByText("Keepers without assigned picks")).toBeTruthy();
    expect(screen.getAllByText("Keeper Player").length).toBeGreaterThan(0);
    const skipped = view.container.querySelector(
      '[data-round="1"][data-pick="1"]',
    );
    expect(skipped?.getAttribute("title")).toContain("Roster full");
    expect(screen.getByLabelText("Roster full skip")).toBeTruthy();
  });

  it("marks exact custom reversed rounds and reverses their board placement", () => {
    const view = render(
      <DraftBoard
        draftSettings={settings}
        draftedPlayers={[]}
        currentTurn={{
          round: 1,
          pickInRound: 1,
          teamId: "Team 2",
          isMyTurn: false,
        }}
        teamStats={[
          { teamId: "Team 1", teamName: "Team 1", owner: "", projectedPoints: 0, categoryTotals: {}, rosterSlots: { C: [] }, bench: [] },
          { teamId: "Team 2", teamName: "Team 2", owner: "", projectedPoints: 0, categoryTotals: {}, rosterSlots: { C: [] }, bench: [] },
        ]}
        draftOrderPattern={{ mode: "custom", reversedRounds: [1] }}
        allPlayers={[]}
        onUpdateTeamName={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Round 1, custom reversed order")).toBeTruthy();
    expect(
      view.container.querySelector(
        '[data-team="Team 1"][data-round="1"][data-pick="2"]',
      ),
    ).toBeTruthy();
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

  it("explains unavailable CSV export access with an account link", () => {
    const onExportCsv = vi.fn();
    render(<DraftSettings settings={settings} onSettingsChange={vi.fn()} myTeamId="Team 1" onMyTeamIdChange={vi.fn()} undoLastPick={vi.fn()} resetDraft={vi.fn()} draftHistory={[]} draftedPlayers={[]} currentPick={1} onExportCsv={onExportCsv} exportCsvMessage="Blended projections export is available with Draft Pro." exportCsvUpgradeHref="/account?section=draft-pro" />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(onExportCsv).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toContain("Blended projections export is available");
    expect(screen.getByRole("link", { name: "Manage Draft Pro access" }).getAttribute("href")).toBe("/account?section=draft-pro");
  });
});

const portableBookmark = () => ({ v: 3, settings: { ...settings, isKeeper: false, scoringCategories: { GOALS: 3 } }, draftedPlayers: [], currentPick: 1, myTeamId: "Team 1", sourceControls: { dtz_skaters: { isSelected: true, weight: 1 } }, goalieSourceControls: { dtz_goalies: { isSelected: true, weight: 1 } } });
function recoverySettings(onBookmarkImport: any, extra: Record<string, unknown> = {}) {
  return <DraftSettings settings={settings} onSettingsChange={vi.fn()} myTeamId="Team 1" onMyTeamIdChange={vi.fn()} undoLastPick={vi.fn()} resetDraft={vi.fn()} draftHistory={[]} draftedPlayers={[]} currentPick={1} onBookmarkImport={onBookmarkImport} {...extra} />;
}
function pasteRecoveryBookmark() {
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
  fireEvent.change(screen.getByLabelText("Import draft bookmark"), { target: { value: JSON.stringify(portableBookmark()) } });
}

describe("portable draft recovery feedback", () => {
  it("ignores a file read completed after the import was abandoned", async () => {
    let finishRead!: (value: string) => void;
    const file = new File(["pending"], "draft.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => new Promise<string>((resolve) => { finishRead = resolve; }) });
    const apply = vi.fn();
    render(recoverySettings(apply));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByLabelText("Read draft bookmark file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel Import" }));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await act(async () => { finishRead(JSON.stringify(portableBookmark())); });
    expect((screen.getByLabelText("Import draft bookmark") as HTMLTextAreaElement).value).toBe("");
    expect(apply).not.toHaveBeenCalled();
  });

  it("leaves a failed import open for retry and never reports unconditional success", () => {
    const apply = vi.fn().mockReturnValueOnce({ status: "failed", message: "Storage is full. Retry." }).mockReturnValue({ status: "accepted", message: "Imported on retry." });
    render(recoverySettings(apply));
    pasteRecoveryBookmark();
    fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
    expect(screen.getByRole("alert").textContent).toContain("Storage is full");
    expect(screen.getByLabelText("Import draft bookmark")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
    expect(screen.queryByLabelText("Import draft bookmark")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Imported on retry");
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("keeps missing-resource feedback visible after an accepted replacement", () => {
    render(recoverySettings(vi.fn(() => ({ status: "missing_resources", message: "Reimport missing rankings." }))));
    pasteRecoveryBookmark();
    fireEvent.click(screen.getByRole("button", { name: "Import Bookmark" }));
    expect(screen.queryByLabelText("Import draft bookmark")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Reimport missing rankings");
  });

  it("ignores duplicate confirmation clicks after an import succeeds", () => {
    const apply = vi.fn(() => ({ status: "accepted", message: "Imported." }));
    render(recoverySettings(apply));
    pasteRecoveryBookmark();
    const confirm = screen.getByRole("button", { name: "Import Bookmark" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("disables recovery actions while live sync owns the draft", () => {
    const apply = vi.fn();
    render(recoverySettings(apply, { draftLocked: true, startNewDraft: vi.fn() }));
    expect((screen.getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Start New Draft" }) as HTMLButtonElement).disabled).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });
});

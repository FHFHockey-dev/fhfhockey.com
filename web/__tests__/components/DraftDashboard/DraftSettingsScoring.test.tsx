import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DraftSettings from "../../../components/DraftDashboard/DraftSettings";
import type { DraftSettings as DraftSettingsContract } from "../../../components/DraftDashboard/DraftDashboard";

vi.mock("components/PlayerAutocomplete", () => ({ default: () => null }));

const settings: DraftSettingsContract = {
  teamCount: 2,
  draftOrder: ["Team 1", "Team 2"],
  scoringCategories: { GOALS: 3 },
  rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 1, utility: 0, bench: 0 },
  isKeeper: false,
};

afterEach(cleanup);

describe("DraftSettings A&G component confirmation", () => {
  afterEach(() => vi.restoreAllMocks());

  const renderSources = (
    sourceControls: Record<string, { isSelected: boolean; weight: number }>,
  ) => {
    const onSourceControlsChange = vi.fn();
    render(
      <DraftSettings
        settings={settings}
        onSettingsChange={vi.fn()}
        myTeamId="Team 1"
        onMyTeamIdChange={vi.fn()}
        undoLastPick={vi.fn()}
        resetDraft={vi.fn()}
        draftHistory={[]}
        draftedPlayers={[]}
        currentPick={1}
        sourceControls={sourceControls}
        onSourceControlsChange={onSourceControlsChange}
      />,
    );
    expect(screen.queryByText(/2026–27 public sources only/)).toBeNull();
    fireEvent.click(screen.getByTestId("open-weights-popover"));
    expect(screen.queryByText(/Use the A&G aggregate or its/)).toBeNull();
    return onSourceControlsChange;
  };

  it.each([
    ["blake_ag_skaters", "Blake A&G (component)", true],
    ["nate_ag_skaters", "Nate A&G (component)", true],
    ["blake_ag_skaters", "Blake A&G (component)", false],
    ["nate_ag_skaters", "Nate A&G (component)", false],
  ] as const)(
    "confirms enabling %s (%s), aggregate selected=%s, and preserves cancellation",
    (id, displayName, aggregateSelected) => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      const controls = {
        ag_skaters: { isSelected: aggregateSelected, weight: 1 },
        [id]: { isSelected: false, weight: 0.75 },
      };
      const onChange = renderSources(controls);
      const toggle = screen.getByRole("checkbox", {
        name: `Toggle source ${displayName}`,
      }) as HTMLInputElement;

      fireEvent.click(toggle);
      expect(confirm).toHaveBeenCalledWith(
        'Enabling "AG Blake" or "AG Nate" alongside "Apples & Ginos" double-weights those projections. Proceed?',
      );
      expect(onChange).not.toHaveBeenCalled();
      expect(toggle.checked).toBe(false);

      confirm.mockReturnValue(true);
      fireEvent.click(toggle);
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        ...controls,
        [id]: { isSelected: true, weight: 0.75 },
      });
    },
  );

  it.each([
    ["blake_ag_skaters", "Blake A&G (component)"],
    ["nate_ag_skaters", "Nate A&G (component)"],
  ])("does not confirm disabling %s", (id, displayName) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onChange = renderSources({ [id]: { isSelected: true, weight: 1 } });
    fireEvent.click(screen.getByRole("checkbox", {
      name: `Toggle source ${displayName}`,
    }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      [id]: { isSelected: false, weight: 1 },
    });
  });

  it("does not confirm enabling other projection sources", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onChange = renderSources({ dtz_skaters: { isSelected: false, weight: 1 } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle source DTZ" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      dtz_skaters: { isSelected: true, weight: 1 },
    });
  });
});

describe("DraftSettings goalie scoring manager", () => {
  it("edits exact custom reversed rounds and locks them after drafting starts", () => {
    const onDraftOrderPatternChange = vi.fn();
    const props = {
      settings,
      onSettingsChange: vi.fn(),
      draftOrderPattern: {
        mode: "custom" as const,
        reversedRounds: [] as number[],
      },
      onDraftOrderPatternChange,
      myTeamId: "Team 1",
      onMyTeamIdChange: vi.fn(),
      undoLastPick: vi.fn(),
      resetDraft: vi.fn(),
      draftHistory: [],
      draftedPlayers: [],
      currentPick: 1,
    };
    const view = render(<DraftSettings {...props} />);

    expect(
      screen.getByRole("tab", { name: "Custom" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Round 2, forward" }));
    expect(onDraftOrderPatternChange).toHaveBeenCalledWith({
      mode: "custom",
      reversedRounds: [2],
    });

    view.rerender(
      <DraftSettings
        {...props}
        structuralSettingsLocked
        draftOrderPattern={{ mode: "custom", reversedRounds: [2] }}
      />,
    );
    expect(
      (screen.getByRole("tab", { name: "Standard" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Round 2, reversed",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("manages goalie stats independently with duplicate-safe add options", () => {
    const onGoalieScoringChange = vi.fn();
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
        goalieScoringCategories={{ WINS_GOALIE: 3, SAVES_GOALIE: 0.2 }}
        onGoalieScoringChange={onGoalieScoringChange}
        availableGoalieStatKeys={[
          "WINS_GOALIE",
          "SAVES_GOALIE",
          "SHUTOUTS_GOALIE",
        ]}
      />,
    );

    const skaterManager = screen.getByTitle("Manage / Add scoring stats");
    const goalieManager = screen.getByTitle("Manage / Add goalie stats");
    expect(skaterManager.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(goalieManager);
    expect(skaterManager.getAttribute("aria-expanded")).toBe("false");

    const select = screen.getByLabelText(
      "Select goalie stat to add",
    ) as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "",
      "SHUTOUTS_GOALIE",
    ]);
    fireEvent.change(select, { target: { value: "SHUTOUTS_GOALIE" } });
    fireEvent.change(screen.getByLabelText("New goalie stat point value"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Stat" }));
    expect(onGoalieScoringChange).toHaveBeenCalledWith({
      WINS_GOALIE: 3,
      SAVES_GOALIE: 0.2,
      SHUTOUTS_GOALIE: 4,
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove WINS_GOALIE" }));
    expect(onGoalieScoringChange).toHaveBeenCalledWith({ SAVES_GOALIE: 0.2 });
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Goalie Scoring" }),
    );
    expect(onGoalieScoringChange).toHaveBeenCalledTimes(3);
  });
});

describe("DraftSettings SHA selectors", () => {
  it("offers derived SHA in both Points and Categories configuration", () => {
    const { unmount } = render(
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
        availableSkaterStatKeys={["GOALS", "SH_ASSISTS"]}
      />,
    );

    fireEvent.click(screen.getByTitle("Manage / Add scoring stats"));
    expect(
      Array.from(
        (screen.getByLabelText("Select stat to add") as HTMLSelectElement)
          .options,
      ).map((option) => [option.value, option.text]),
    ).toContainEqual(["SH_ASSISTS", "SHA"]);

    unmount();
    render(
      <DraftSettings
        settings={{
          ...settings,
          leagueType: "categories",
          categoryWeights: {},
        }}
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
        availableSkaterStatKeys={["GOALS", "SH_ASSISTS"]}
      />,
    );

    fireEvent.click(screen.getByTitle("Manage / Add categories"));
    expect(
      Array.from(
        (screen.getByLabelText("Select category to add") as HTMLSelectElement)
          .options,
      ).map((option) => [option.value, option.text]),
    ).toContainEqual(["SH_ASSISTS", "SHA"]);
  });
});

describe("DraftSettings Yahoo lock", () => {
  it("visibly disables draft structure, roster, scoring, undo, and reset controls", () => {
    const onSettingsChange = vi.fn();
    const onSnakeDraftChange = vi.fn();
    const undoLastPick = vi.fn();
    const resetDraft = vi.fn();
    render(
      <DraftSettings
        settings={{ ...settings, isKeeper: true }}
        onSettingsChange={onSettingsChange}
        isSnakeDraft
        onSnakeDraftChange={onSnakeDraftChange}
        myTeamId="Team 1"
        onMyTeamIdChange={vi.fn()}
        undoLastPick={undoLastPick}
        resetDraft={resetDraft}
        draftHistory={[{ players: [], pickNumber: 1 }]}
        draftedPlayers={[
          {
            playerId: "1",
            teamId: "Team 1",
            pickNumber: 1,
            round: 1,
            pickInRound: 1,
          },
        ]}
        currentPick={2}
        draftLocked
        draftLockReason="Yahoo live sync controls this draft."
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Yahoo live sync");
    expect(
      (screen.getByTestId("team-count-select") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("roster-input-C") as HTMLInputElement).closest(
        "fieldset",
      )?.hasAttribute("disabled"),
    ).toBe(true);
    expect(
      (
        screen.getByRole("tab", {
          name: "Snake",
          hidden: true,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("undo-pick-btn") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("reset-draft-btn") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByTestId("undo-pick-btn"));
    fireEvent.click(screen.getByTestId("reset-draft-btn"));
    expect(undoLastPick).not.toHaveBeenCalled();
    expect(resetDraft).not.toHaveBeenCalled();
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(onSnakeDraftChange).not.toHaveBeenCalled();
  });
});

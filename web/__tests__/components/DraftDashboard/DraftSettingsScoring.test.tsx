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

describe("DraftSettings goalie scoring manager", () => {
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

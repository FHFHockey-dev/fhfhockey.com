import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import QuickFixModal from "../../../components/DraftDashboard/QuickFixModal";

afterEach(cleanup);

describe("QuickFixModal", () => {
  it("describes the selected pick and submits an available replacement", async () => {
    const onReplace = vi.fn(() => ({ ok: true, message: "Pick replaced." }));
    render(
      <QuickFixModal
        open
        onClose={vi.fn()}
        teamCount={2}
        roundCount={2}
        draftedPlayers={[
          {
            playerId: "1",
            teamId: "Team 1",
            pickNumber: 1,
            round: 1,
            pickInRound: 1,
          },
          {
            playerId: "2",
            teamId: "Team 2",
            pickNumber: 2,
            round: 1,
            pickInRound: 2,
          },
        ]}
        availablePlayers={[{ id: "9", fullName: "Replacement Player" }]}
        allPlayerNames={
          new Map([
            ["1", "First Player"],
            ["2", "Wrong Player"],
          ])
        }
        customTeamNames={{ "Team 2": "Second Team" }}
        onReplace={onReplace}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Quick Fix Draft Pick" }),
    ).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Wrong Player")).toBeTruthy());
    expect(screen.getByText("Second Team")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Replacement player"), {
      target: { value: "Replacement Player" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace Player" }));
    expect(onReplace).toHaveBeenCalledWith(2, "9");
  });
});

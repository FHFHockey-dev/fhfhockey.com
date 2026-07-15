import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ManageTradesModal from "../../../components/DraftDashboard/ManageTradesModal";

afterEach(cleanup);

const trade = {
  version: 1 as const,
  status: "valid" as const,
  round: 2,
  pickInRound: 1,
  pickNumber: 3,
  originalTeamId: "Team 2",
  currentTeamId: "Team 1"
};

describe("ManageTradesModal", () => {
  it("supports edit, transactional bulk feedback, reset confirmation, and focus restore", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open trades";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const onSave = vi.fn(() => ({ ok: true, message: "Trade saved." }));
    const onImport = vi.fn(() => ({
      ok: false,
      message: "Row 2: New owner is already the original owner."
    }));
    const onReset = vi.fn();
    const view = render(
      <ManageTradesModal
        open
        onClose={onClose}
        draftOrder={["Team 1", "Team 2"]}
        roundCount={4}
        trades={[trade]}
        onSave={onSave}
        onImport={onImport}
        onRemove={vi.fn()}
        onReset={onReset}
      />
    );

    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Trade" }));
    expect(onSave).toHaveBeenCalledWith(2, 1, "Team 1");

    fireEvent.change(screen.getByLabelText(/JSON or CSV/), {
      target: { value: "round,pickInRound,currentTeamId\n1,1,Team 2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Trades" }));
    expect(screen.getByRole("alert").textContent).toContain("Row 2");

    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Reset All" }));
    expect(onReset).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(
      <ManageTradesModal
        open={false}
        onClose={onClose}
        draftOrder={["Team 1", "Team 2"]}
        roundCount={4}
        trades={[]}
        onSave={onSave}
        onImport={onImport}
        onRemove={vi.fn()}
        onReset={onReset}
      />
    );
    await waitFor(() => expect(document.activeElement).toBe(opener));
    opener.remove();
  });
});

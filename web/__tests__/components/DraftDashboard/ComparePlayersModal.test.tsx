import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Radar: () => <div aria-label="Radar chart" />,
}));
vi.mock("next/image", () => ({
  default: (props: any) => {
    const { unoptimized: _unoptimized, ...imageProps } = props;
    return <img {...imageProps} />;
  },
}));

import ComparePlayersModal from "../../../components/DraftDashboard/ComparePlayersModal";

const players = [
  {
    playerId: 1,
    fullName: "First Player",
    displayTeam: "CAR",
    displayPosition: "C",
    combinedStats: {},
    fantasyPoints: { projected: 20 },
  },
  {
    playerId: 2,
    fullName: "Second Player",
    displayTeam: "EDM",
    displayPosition: "D",
    combinedStats: {},
    fantasyPoints: { projected: 18 },
  },
] as any;

afterEach(cleanup);

describe("ComparePlayersModal accessibility", () => {
  it("focuses the close control, closes on Escape, and restores opener focus", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open comparison";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const view = render(
      <ComparePlayersModal
        open
        onClose={onClose}
        selectedIds={["1", "2"]}
        allPlayers={players}
      />,
    );

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Close" }),
      ),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    view.rerender(
      <ComparePlayersModal
        open={false}
        onClose={onClose}
        selectedIds={["1", "2"]}
        allPlayers={players}
      />,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("closes only when the backdrop itself is clicked", () => {
    const onClose = vi.fn();
    render(
      <ComparePlayersModal
        open
        onClose={onClose}
        selectedIds={["1", "2"]}
        allPlayers={players}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Compare Players" });
    fireEvent.click(screen.getByText("Compare Players"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

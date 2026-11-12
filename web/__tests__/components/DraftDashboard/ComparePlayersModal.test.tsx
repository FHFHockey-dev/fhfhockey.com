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

describe("ComparePlayersModal unknown values (audit W2-5 D10)", () => {
  it("shows a missing projection as unknown, not the 50th percentile", () => {
    const stat = (projected: number) => ({ projected });
    const pool = [
      { ...players[0], displayPosition: "C", combinedStats: { GOALS: stat(30) } },
      { ...players[1], displayPosition: "C", combinedStats: {} },
      { playerId: 3, fullName: "Third", displayTeam: "TOR", displayPosition: "C", combinedStats: { GOALS: stat(10) }, fantasyPoints: { projected: 5 } },
    ] as any;
    render(<ComparePlayersModal open onClose={vi.fn()} selectedIds={["1", "2"]} allPlayers={pool} />);
    const row = screen.getAllByText("G").map((label) => label.closest("[class]")?.parentElement?.textContent ?? "").join(" | ");
    expect(row).toContain("—");
    expect(row).not.toMatch(/G50/);
    // First player: GOALS 30 is the top of [10, 30] → mid-rank 75.
    expect(row).toMatch(/G75/);
  });
});

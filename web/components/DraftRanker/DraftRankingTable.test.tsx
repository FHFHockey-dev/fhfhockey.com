import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DraftRankingEntry } from "hooks/useDraftRanking";

import DraftRankingTable from "./DraftRankingTable";

afterEach(cleanup);

function entry(
  playerId: number,
  rank: number,
  name: string,
): DraftRankingEntry {
  return {
    playerId,
    rank,
    orderKey: rank * 1048576,
    seedSource: "yahoo_adp",
    seedAdp: rank + 0.3,
    seedRank: rank,
    tier: null,
    notes: null,
    updatedAt: "2026-07-15T00:00:00Z",
    player: {
      canonical_name: name,
      canonical_position: "C",
      current_organization_name: "Edmonton Oilers",
      headshot_url: null,
      lifecycle_status: "active",
    },
  };
}

describe("DraftRankingTable", () => {
  it("refreshes numeric rank inputs after the ordered entries change", () => {
    const onReorder = vi.fn();
    const { rerender } = render(
      <DraftRankingTable
        entries={[
          entry(10, 1, "Connor McDavid"),
          entry(11, 2, "Nathan MacKinnon"),
        ]}
        isSaving={false}
        onReorder={onReorder}
      />,
    );

    expect(
      (screen.getByLabelText(
        "New rank for Nathan MacKinnon",
      ) as HTMLInputElement).valueAsNumber,
    ).toBe(2);

    rerender(
      <DraftRankingTable
        entries={[
          entry(10, 1, "Connor McDavid"),
          entry(11, 3, "Nathan MacKinnon"),
        ]}
        isSaving={false}
        onReorder={onReorder}
      />,
    );

    expect(
      (screen.getByLabelText(
        "New rank for Nathan MacKinnon",
      ) as HTMLInputElement).valueAsNumber,
    ).toBe(3);
  });

  it("offers numeric movement and accessible insert-above controls", () => {
    const onReorder = vi.fn();
    render(
      <DraftRankingTable
        entries={[
          entry(10, 1, "Connor McDavid"),
          entry(11, 2, "Nathan MacKinnon"),
        ]}
        isSaving={false}
        onReorder={onReorder}
      />,
    );

    const mcdavidRow = screen.getByText("Connor McDavid").closest("tr")!;
    const mackinnonRow = screen.getByText("Nathan MacKinnon").closest("tr")!;
    fireEvent.click(within(mcdavidRow).getByRole("button", { name: "Select" }));
    fireEvent.click(
      within(mackinnonRow).getByRole("button", { name: "Above" }),
    );

    expect(onReorder).toHaveBeenCalledWith({
      action: "insert_above",
      playerId: 10,
      anchorPlayerId: 11,
    });

    fireEvent.change(
      within(mackinnonRow).getByLabelText("New rank for Nathan MacKinnon"),
      { target: { value: "1" } },
    );
    fireEvent.submit(
      within(mackinnonRow)
        .getByRole("button", { name: "Move" })
        .closest("form")!,
    );
    expect(onReorder).toHaveBeenCalledWith({
      action: "move_to_rank",
      playerId: 11,
      targetRank: 1,
    });
  });

  it("keeps candidates in the same ordered dataset beyond rank 250", () => {
    const entries = Array.from({ length: 251 }, (_, index) =>
      entry(index + 1, index + 1, `Player ${index + 1}`),
    );
    render(
      <DraftRankingTable
        entries={entries}
        isSaving={false}
        onReorder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Candidates (1)" }));

    expect(screen.getByText("Player 251")).toBeTruthy();
    expect(screen.getByText("#251")).toBeTruthy();
    expect(screen.getByText("Candidate bench")).toBeTruthy();
  });
});

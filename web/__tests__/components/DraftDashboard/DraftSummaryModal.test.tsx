import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

import DraftSummaryModal from "../../../components/DraftDashboard/DraftSummaryModal";
import RoundRankChart from "../../../components/DraftDashboard/RoundRankChart";

afterEach(cleanup);

describe("round rank chart", () => {
  it("delays hover emphasis and retains an explicitly selected team", () => {
    vi.useFakeTimers();
    try {
      render(<RoundRankChart teams={[{ teamId: "a", teamName: "Alpha" }, { teamId: "b", teamName: "Beta" }]} myTeamId="a"
        history={[{ round: 0, ranks: { a: 1, b: 1 }, picks: [] }, { round: 1, ranks: { a: 2, b: 1 }, picks: [{ teamId: "b", playerId: "p", round: 1, pickInRound: 2, pickNumber: 2 }] }]}
        players={new Map([["p", { fullName: "Test Player", displayPosition: "C" }]])} />);
      const beta = screen.getByRole("button", { name: "Beta" });
      fireEvent.mouseEnter(beta);
      act(() => vi.advanceTimersByTime(999));
      expect(beta.getAttribute("aria-pressed")).toBe("false");
      act(() => vi.advanceTimersByTime(1));
      expect(beta.getAttribute("aria-pressed")).toBe("true");
      fireEvent.mouseLeave(beta);
      expect(beta.getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(beta);
      fireEvent.mouseLeave(beta);
      expect(beta.getAttribute("aria-pressed")).toBe("true");
      const alphaLine = screen.getByLabelText(/Alpha · Round 1 · Rank 2/).parentElement!;
      fireEvent.mouseEnter(alphaLine);
      act(() => vi.advanceTimersByTime(1000));
      expect(alphaLine.getAttribute("data-active")).toBe("true");
      fireEvent.mouseLeave(alphaLine);
      expect(beta.getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByLabelText(/Beta · Round 1 · Rank 1/).textContent).toContain("Test Player · C · Round 1, pick 2, overall #2");
    } finally { vi.useRealTimers(); }
  });
});

describe("DraftSummaryModal configuration evidence", () => {
  it("lists no-pick keepers separately from the recap board", () => {
    render(
      <DraftSummaryModal
        isOpen
        onClose={vi.fn()}
        draftSettings={{
          teamCount: 1,
          draftOrder: ["Team 1"],
          scoringCategories: {},
          rosterConfig: {
            C: 1,
            LW: 0,
            RW: 0,
            D: 0,
            G: 0,
            utility: 0,
            bench: 0,
          },
        }}
        draftedPlayers={[]}
        teamStats={[
          {
            teamId: "Team 1",
            teamName: "Keepers United",
            owner: "Team 1",
            projectedPoints: 10,
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
          },
        ]}
        allPlayers={[
          {
            playerId: 1,
            fullName: "No Cost Keeper",
            fantasyPoints: { projected: 10 },
            combinedStats: {},
          } as any,
        ]}
        keepers={[
          {
            version: 2,
            status: "valid",
            cost: "none",
            playerId: "1",
            teamId: "Team 1",
          },
        ]}
      />,
    );

    const keeperList = screen.getByRole("region", {
      name: "No-pick keepers",
    });
    expect(keeperList.textContent).toContain("No Cost Keeper");
    expect(keeperList.textContent).toContain("Keepers United");
  });

  it("renders source weights and privacy-safe custom metadata", () => {
    render(
      <DraftSummaryModal
        isOpen
        onClose={vi.fn()}
        draftSettings={{
          teamCount: 1,
          draftOrder: ["Team 1"],
          scoringCategories: { GOALS: 3 },
          rosterConfig: {
            C: 1,
            LW: 0,
            RW: 0,
            D: 0,
            G: 0,
            utility: 0,
            bench: 0,
          },
          isKeeper: false,
        }}
        draftedPlayers={[]}
        teamStats={[]}
        allPlayers={[]}
        configurationSummary={{
          forwardGrouping: "fwd",
          baselineMode: "remaining",
          personalizeReplacement: true,
          needWeightEnabled: true,
          needAlpha: 0.4,
          sources: [
            {
              id: "official",
              label: "Official source",
              playerType: "skater",
              enabled: true,
              weight: 1.25,
              custom: false,
            },
          ],
          customSources: [
            {
              id: "custom_csv_1",
              label: "Private rankings",
              totalRows: 12,
              coverage: 0.75,
            },
          ],
        }}
      />,
    );

    const summary = screen.getByRole("region", {
      name: "Draft configuration summary",
    });
    expect(summary.textContent).toContain("Official source · on · weight 1.25");
    expect(summary.textContent).toContain(
      "Private rankings · 12 rows · 75.0% mapped",
    );
    expect(summary.textContent).toContain(
      "CSV row contents are intentionally excluded",
    );
  });

  it("traps keyboard focus, closes on Escape, and restores opener focus", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open draft summary";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const props = {
      onClose,
      draftSettings: {
        teamCount: 1,
        draftOrder: ["Team 1"],
        scoringCategories: { GOALS: 3 },
        rosterConfig: {
          C: 1,
          LW: 0,
          RW: 0,
          D: 0,
          G: 0,
          utility: 0,
          bench: 0,
        },
        isKeeper: false,
      },
      draftedPlayers: [],
      teamStats: [],
      allPlayers: [],
    } as any;
    const view = render(<DraftSummaryModal isOpen {...props} />);

    const closeButton = screen.getByRole("button", {
      name: "Close Draft Summary",
    });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    const firstButton = screen.getByRole("button", { name: "Recap" });
    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(firstButton);
    firstButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(<DraftSummaryModal isOpen={false} {...props} />);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

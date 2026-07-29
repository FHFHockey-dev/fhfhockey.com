import {
  cleanup,
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

afterEach(cleanup);

describe("DraftSummaryModal configuration evidence", () => {
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

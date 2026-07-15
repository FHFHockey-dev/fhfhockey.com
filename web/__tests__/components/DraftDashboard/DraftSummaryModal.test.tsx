import { cleanup, render, screen } from "@testing-library/react";
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
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GoalieCard from "./GoalieCard";

const baseGoalie = {
  playerId: 1,
  playerName: "Alpha One",
  position: "G",
  sweaterNumber: 31,
  lineChange: "static" as const
};

function statValue(section: HTMLElement, label: string) {
  const labelNode = within(section).getByText(label, { selector: "div" });
  return labelNode.nextElementSibling?.textContent;
}

describe("GoalieCard (W2-P0-12)", () => {
  it("shows pooled values and an unknown record as a dash, not 0", () => {
    render(
      <GoalieCard
        {...(baseGoalie as any)}
        last10Games={{ GP: 2, SV: 31, SVPercentage: 31 / 33, GAA: 7200 / 4200, Record: null }}
        season={{ GP: 2, SV: 31, SVPercentage: 31 / 33, GAA: null, Record: "1-0-0" }}
      />
    );

    const [last10, season] = screen.getAllByText("RECORD").map(
      (node) => node.closest("section") as HTMLElement
    );
    expect(screen.getByText("LAST 10 GP")).toBeTruthy();
    expect(statValue(last10, "RECORD")).toBe("—");
    expect(statValue(last10, "SV%")).toBe(".939");
    expect(statValue(last10, "GAA")).toBe("1.71");
    expect(statValue(season, "RECORD")).toBe("1-0-0");
    expect(statValue(season, "GAA")).toBe("—");
  });

  it("labels a goalie with no appearances instead of showing zeros", () => {
    render(
      <GoalieCard
        {...(baseGoalie as any)}
        last10Games={{ GP: 0, SV: 0, SVPercentage: null, GAA: null, Record: "0-0-0" }}
        season={{ GP: 0, SV: 0, SVPercentage: null, GAA: null, Record: "0-0-0" }}
      />
    );
    expect(screen.getByText("No appearances yet this season")).toBeTruthy();
  });
});

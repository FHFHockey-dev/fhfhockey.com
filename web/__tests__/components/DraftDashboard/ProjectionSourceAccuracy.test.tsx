import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ProjectionSourceAccuracy from "../../../components/DraftDashboard/ProjectionSourceAccuracy";

afterEach(cleanup);

const player = {
  playerId: 1,
  fullName: "Player",
  displayTeam: "TST",
  displayPosition: "C",
  fantasyPoints: {},
  combinedStats: {
    GAMES_PLAYED: {
      actual: 50,
      projectedDetail: {
        contributingSources: [{ name: "Source A", weight: 1, value: 100 }]
      }
    },
    GOALS: {
      actual: 10,
      projectedDetail: {
        statDefinition: { key: "GOALS", dataType: "number" },
        contributingSources: [{ name: "Source A", weight: 1, value: 20 }]
      }
    }
  }
} as any;

describe("ProjectionSourceAccuracy", () => {
  it("separates Total and Per Game semantics without offering weight mutation", () => {
    render(<ProjectionSourceAccuracy players={[player]} />);

    expect(screen.getByText(/never modify your manual source weights/)).toBeTruthy();
    expect(screen.getByText(/season-total projection/)).toBeTruthy();
    expect(screen.getByText("0.0%")).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Per Game" }));
    expect(screen.getByText(/source's projected GP/)).toBeTruthy();
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
  });

  it("renders an honest empty state", () => {
    render(<ProjectionSourceAccuracy players={[]} />);
    expect(screen.getByRole("status").textContent).toContain(
      "No source/actual comparisons"
    );
  });
});

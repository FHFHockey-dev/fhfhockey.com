import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
      actual: 15,
      projectedDetail: {
        contributingSources: [{ name: "Source A", weight: 1, value: 84 }]
      }
    },
    GOALS: {
      actual: 7.5,
      projectedDetail: {
        statDefinition: { key: "GOALS", dataType: "numeric" },
        contributingSources: [{ name: "Source A", weight: 1, value: 42 }]
      }
    }
  }
} as any;

describe("ProjectionSourceAccuracy", () => {
  it("compares like with like and never offers weight mutation", () => {
    render(<ProjectionSourceAccuracy players={[player]} />);

    expect(screen.getByText(/never modify your manual source weights/)).toBeTruthy();
    expect(screen.getByText(/divided by its projected GP/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Total" })).toBeNull();
    expect(screen.queryByText(/0\.0%/)).toBeNull();
    // An exactly right per-game source at 15 of 84 games: zero error, rank 1.
    const row = screen.getByRole("row", { name: /Source A/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Source A",
      "1",
      "0",
      "1/1",
      "0"
    ]);
    expect(screen.queryByRole("slider")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pro-rated total" }));
    expect(screen.getByText(/pro-rated to actual games played/)).toBeTruthy();
  });

  it("renders an honest empty state", () => {
    render(<ProjectionSourceAccuracy players={[]} />);
    expect(screen.getByRole("status").textContent).toContain(
      "No source/actual comparisons"
    );
  });
});

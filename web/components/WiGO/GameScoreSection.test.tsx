import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameScoreSection from "./GameScoreSection";

vi.mock("./GameScoreLineChart", () => ({ default: () => <div data-testid="game-score-chart" /> }));
afterEach(cleanup);

describe("GameScoreSection", () => {
  it("discloses that the on-ice goal term is all-situation, not the published 5v5 model", () => {
    render(<GameScoreSection playerId={1} seasonId={20252026} />);
    const help = screen.getByText(/Per-game score:/);
    expect(help.textContent).toContain("0.15×(on-ice goals for − against)");
    expect(help.textContent).toMatch(/Unlike the published 5v5 model, the on-ice goal term counts all situations/);
    expect(screen.getByTestId("game-score-chart")).toBeTruthy();
  });
});

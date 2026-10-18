import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameGridPage from "pages/game-grid/[mode]";

vi.mock("components/GameGrid", () => ({ default: () => <div data-testid="game-grid" /> }));
vi.mock("next/router", () => ({ default: { query: { mode: "7-Day-Forecast" }, replace: vi.fn() } }));
vi.mock("next-seo", () => ({ NextSeo: () => null }));
afterEach(cleanup);

describe("Game Grid page", () => {
  it("mounts the Keep exploring workflow links below the grid", () => {
    render(<GameGridPage initialMode="7-Day-Forecast" />);
    expect(screen.getByTestId("game-grid")).toBeTruthy();
    expect(screen.getByText("Keep exploring")).toBeTruthy();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href")))
      .toEqual(["/start-chart", "/trends", "/lines", "/variance/goalies"]);
  });
});

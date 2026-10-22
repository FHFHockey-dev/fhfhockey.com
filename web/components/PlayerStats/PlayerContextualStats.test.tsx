import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerContextualStats } from "./PlayerContextualStats";

vi.mock("hooks/useMissedGames", () => ({ useMissedGames: () => ({ missedGames: null }) }));
afterEach(cleanup);

const row = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-10-20", games_played: 1, games_started: 1,
  wins: 0, saves: 27, shots_against: 30, quality_start: 0, ...overrides
});
const renderGoalie = (gameLog: ReturnType<typeof row>[]) => render(
  <PlayerContextualStats player={{ id: 999001, fullName: "Synthetic Goalie", position: "G" }}
    gameLog={gameLog} playoffGameLog={[]} seasonTotals={[]} isGoalie
    missedGames={null} asOfDate="2026-10-22" />
);
const card = (label: string) => within(screen.getByText(label).parentElement!);

describe("P02 goalie contextual support", () => {
  it("uses classified starts, retaining relief as participation but outside QS", () => {
    renderGoalie([row({ quality_start: 1 }), row(), row({ games_started: 0, quality_start: null })]);
    expect(card("Quality Start Rate").getByText("50.0%")).toBeTruthy();
    expect(card("Quality Start Rate").getByText(/2 of 2 starts classified/)).toBeTruthy();
    expect(screen.getByText("3 games")).toBeTruthy();
  });

  it.each([
    { games_started: null, quality_start: 1 },
    { games_started: undefined, quality_start: 1 },
    { games_started: 1, quality_start: null },
    { games_started: 1, quality_start: undefined },
    { games_started: 1, quality_start: " " },
    { games_started: 1, quality_start: 2 }
  ])("withholds QS when starts or classification is unknown/invalid: %j", (missing) => {
    renderGoalie([row({ quality_start: 1 }), row(missing)]);
    expect(card("Quality Start Rate").getByText("-")).toBeTruthy();
    expect(screen.queryByText("Inconsistent starts")).toBeNull();
  });

  it("preserves a classified zero QS rate and withholds a relief-only rate", () => {
    const view = renderGoalie([row()]);
    expect(card("Quality Start Rate").getByText("0.0%")).toBeTruthy();
    view.unmount();
    renderGoalie([row({ games_started: 0, quality_start: null })]);
    expect(card("Quality Start Rate").getByText("-")).toBeTruthy();
  });

  it("withholds SV when an appearance is missing one paired count", () => {
    renderGoalie([row(), row({ saves: null, shots_against: 10 })]);
    expect(card("Save Percentage").getByText("-")).toBeTruthy();
    expect(screen.queryByText("Needs improvement")).toBeNull();
  });

  it("pools valid SV counts and ignores a known nonappearance", () => {
    renderGoalie([row(), row({ saves: 10, shots_against: 10, games_started: 0 }),
      row({ games_played: 0, games_started: 0, saves: null, shots_against: null })]);
    expect(card("Save Percentage").getByText("0.925")).toBeTruthy();
  });
});

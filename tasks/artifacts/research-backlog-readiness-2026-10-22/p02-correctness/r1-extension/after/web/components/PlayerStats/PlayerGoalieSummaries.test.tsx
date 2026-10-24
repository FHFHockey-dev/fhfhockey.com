import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlayerStatsSummary } from "./PlayerStatsSummary";
import { PlayerSummaryStrip } from "./PlayerSummaryStrip";
import type { GameLogEntry } from "./types";

afterEach(cleanup);

const row = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-10-20", games_played: 1, games_started: 1,
  saves: 27, shots_against: 30, goals_against: 3, time_on_ice: 3600,
  ...overrides
});
// Exercise raw nullable/invalid input and the existing numeric-seconds contract.
const log = (...rows: ReturnType<typeof row>[]) => rows as unknown as GameLogEntry[];
const expectRates = (sv: string, gaa: string) => {
  expect(within(screen.getByText("SV%").parentElement!).getByText(sv)).toBeTruthy();
  expect(within(screen.getByText("GAA").parentElement!).getByText(gaa)).toBeTruthy();
};
const consumers = [
  { name: "Overview", render: (gameLog: GameLogEntry[]) => render(
    <PlayerSummaryStrip gameLog={gameLog} isGoalie windowLabel="Selected games" />
  ) },
  { name: "Trends", render: (gameLog: GameLogEntry[]) => render(
    <PlayerStatsSummary gameLog={gameLog} selectedStats={["save_pct", "goals_against_avg"]} isGoalie />
  ) }
];

describe.each(consumers)("P02-R1 $name goalie summary", ({ render: renderSummary }) => {
  it.each([null, undefined, -1, NaN])("withholds ratios before filtering unknown participation: %s", (games_played) => {
    renderSummary(log(row(), row({ games_played, saves: null, shots_against: 10, goals_against: null })));
    expectRates("-", "-");
  });

  it("does not infer participation from complete counts", () => {
    renderSummary(log(row(), row({ games_played: null })));
    expectRates("-", "-");
  });

  it("pools complete appearance pairs and excludes a known zero despite missing counts", () => {
    renderSummary(log(row(), row({ saves: 10, shots_against: 10, goals_against: 1, time_on_ice: 600, games_started: 0 }),
      row({ games_played: 0, saves: null, shots_against: null, goals_against: null, time_on_ice: null })));
    expectRates("0.925", "3.43");
  });

  it("preserves observed zero ratios with positive exposure", () => {
    renderSummary(log(row({ saves: 0, shots_against: 10, goals_against: 0 })));
    expectRates("0.000", "0.00");
  });

  it("withholds a missing exposure pair even when participation is known", () => {
    renderSummary(log(row(), row({ saves: null, shots_against: 10, time_on_ice: null })));
    expectRates("-", "-");
  });
});

it("validates the selected Trends window when switching between regular season and playoffs", () => {
  const props = {
    gameLog: log(row()),
    playoffGameLog: log(row(), row({ games_played: null, saves: null })),
    selectedStats: ["save_pct", "goals_against_avg"], isGoalie: true
  };
  const view = render(<PlayerStatsSummary {...props} />);
  expectRates("0.900", "3.00");
  view.rerender(<PlayerStatsSummary {...props} showPlayoffData />);
  expectRates("-", "-");
});

it("preserves skater count and shooting percentage summaries", () => {
  const gameLog = log(row({ goals: 1, shots: 4 }), row({ games_played: null, goals: null, shots: null }));
  const view = render(<PlayerSummaryStrip gameLog={gameLog} isGoalie={false} windowLabel="Selected games" />);
  expect(within(screen.getByText("Goals").parentElement!).getByText("1")).toBeTruthy();
  expect(within(screen.getByText("SH%").parentElement!).getByText("25.0%")).toBeTruthy();
  view.unmount();
  render(<PlayerStatsSummary gameLog={gameLog} selectedStats={["goals", "shooting_percentage"]} isGoalie={false} />);
  expect(within(screen.getByText("G").parentElement!).getByText("1")).toBeTruthy();
  expect(within(screen.getByText("SH%").parentElement!).getByText("25.0%")).toBeTruthy();
});

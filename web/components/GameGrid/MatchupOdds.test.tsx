import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameData, Team } from "lib/NHL/types";
import TeamRow from "./TeamRow";
import VerticalMatchupCell from "./VerticalMatchupCell";

const teams: Record<number, Team> = {
  12: { id: 12, name: "Carolina Hurricanes", abbreviation: "CAR", logo: "/car.svg" },
  13: { id: 13, name: "Florida Panthers", abbreviation: "FLA", logo: "/fla.svg" },
};

vi.mock("./contexts/GameGridContext", () => ({ useTeam: (id: number) => teams[id],
  useGoaliePresentation: () => ({ enabled: false, requested: false, snapshot: null, contextKey: "", asOf: "2026-10-07T12:00:00Z", status: "unavailable" }) }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/legacy/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
const heatMap = vi.hoisted(() => ({ props: [] as Array<{ homeTeamId: number; awayTeamId: number; gameId: number }> }));
vi.mock("./PDHC/PoissonHeatMap", () => ({ default: (props: { homeTeamId: number; awayTeamId: number; gameId: number }) => {
  heatMap.props.push(props); return null; } }));

afterEach(cleanup);

// A stale payload that still carries model odds (decision 64: they must never surface).
const game: GameData = { id: 2026020100, season: 20262027, gameType: 2, gameDate: "2026-10-08", gameState: "FUT",
  homeTeam: { id: 12, winOdds: 71.2, apiWinOdds: 71.2 }, awayTeam: { id: 13, winOdds: 28.8, apiWinOdds: 28.8 } } as GameData;

describe("Game Grid matchup cells withhold model odds (W1 P0 #14, decision 64)", () => {
  it("a team row shows no stored odds and labels the cell Odds n/a: Model odds unavailable", () => {
    const { container } = render(<table><tbody><TeamRow teamId={12} extended={false} rank={1} totalGamesPlayed={1}
      totalOffNights={0} weekScore={-100} excludedDays={[]} games={[]} WED={game} /></tbody></table>);
    expect(container.textContent).not.toMatch(/71\.2|28\.8/);
    const cell = screen.getByRole("button", { name: /Florida Panthers/ });
    expect(cell.getAttribute("aria-label")).toBe("Carolina Hurricanes vs Florida Panthers. Odds n/a: Model odds unavailable. Open game details.");
    expect(cell.querySelector("[title='Model odds unavailable']")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/71\.2|28\.8/);
  });

  it("the transposed cell reads odds through the withheld path, not the raw payload", () => {
    const { container } = render(<VerticalMatchupCell gameData={game} teamId={12} />);
    const cell = screen.getByRole("button");
    expect(cell.getAttribute("aria-label")).toBe("Home game vs Florida Panthers. Odds n/a: Model odds unavailable. Open game details.");
    expect(container.innerHTML).not.toMatch(/71\.2|28\.8/);
  });

  it("a final keeps its score and carries no odds label", () => {
    const final = { ...game, gameState: "OFF", homeTeam: { ...game.homeTeam, score: 4 }, awayTeam: { ...game.awayTeam, score: 2 } } as GameData;
    render(<VerticalMatchupCell gameData={final} teamId={13} />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Away game at Carolina Hurricanes. 4-2. Open game details.");
  });

  it("gives the transposed cell's game details the real home and away teams from either side", () => {
    for (const teamId of [12, 13]) {
      heatMap.props.length = 0;
      render(<VerticalMatchupCell gameData={game} teamId={teamId} />);
      fireEvent.click(screen.getByRole("button"));
      expect(heatMap.props.at(-1)).toEqual({ homeTeamId: 12, awayTeamId: 13, gameId: game.id });
      cleanup();
    }
  });
});

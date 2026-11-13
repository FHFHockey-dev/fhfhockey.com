import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SkaterStats } from "pages/lines/[abbreviation]";

import LineShareBars from "./LineShareBars";

function skater(playerId: number, overrides: Partial<SkaterStats>): SkaterStats {
  return {
    playerId,
    playerName: `Player ${playerId}`,
    position: "C",
    sweaterNumber: playerId,
    lineChange: "static",
    Goals: 1,
    Assists: 0,
    PTS: 1,
    PPP: 0,
    Shots: 0,
    Hits: 0,
    Blocks: 0,
    PlusMinus: 0,
    ...overrides,
  };
}

/** The rendered percentages in order: L1 ice time, L1 goals, L2 ice time, L2 goals... */
function shares() {
  return screen
    .getAllByText(/^(\d+\.\d%|—)$/)
    .map((element) => element.textContent);
}

afterEach(cleanup);

describe("LineShareBars", () => {
  it("renders recent timeshare and goal-share rows for each line", () => {
    render(
      <LineShareBars
        lines={[
          {
            label: "L1",
            players: [
              {
                playerId: 1,
                playerName: "Alpha Center",
                position: "C",
                sweaterNumber: 97,
                lineChange: "static",
                Goals: 4,
                Assists: 3,
                PTS: 7,
                PPP: 2,
                Shots: 20,
                Hits: 1,
                Blocks: 1,
                PlusMinus: 1,
                TOISeconds: 900,
              },
            ],
          },
          {
            label: "L2",
            players: [
              {
                playerId: 2,
                playerName: "Beta Wing",
                position: "LW",
                sweaterNumber: 29,
                lineChange: "static",
                Goals: 2,
                Assists: 4,
                PTS: 6,
                PPP: 1,
                Shots: 14,
                Hits: 1,
                Blocks: 1,
                PlusMinus: 1,
                TOISeconds: 600,
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByText("Recent line share")).toBeTruthy();
    expect(screen.getByText("L1")).toBeTruthy();
    expect(screen.getByText("L2")).toBeTruthy();
    expect(screen.getAllByText(/Ice time share|Goal share/).length).toBeGreaterThan(1);
  });

  it("compares lines by their players' ice time per game played, not 10-game totals", () => {
    render(
      <LineShareBars
        lines={[
          {
            label: "L1",
            players: [1, 2, 3].map((id) => skater(id, { TOISeconds: 10_000, numGames: 10 })),
          },
          {
            // A call-up who dressed for 2 of the 10 games, at the same 900 s a game.
            label: "L2",
            players: [
              skater(4, { TOISeconds: 9_000, numGames: 10 }),
              skater(5, { TOISeconds: 9_000, numGames: 10 }),
              skater(6, { TOISeconds: 1_800, numGames: 2 }),
            ],
          },
          {
            // Two players on the board (one was not placed), 800 s a game each.
            label: "L3",
            players: [7, 8].map((id) => skater(id, { TOISeconds: 8_000, numGames: 10 })),
          },
        ]}
      />
    );

    // 1000 : 900 : 800 per game. The old member totals (30000 : 19800 : 16000)
    // gave 45.6% / 30.1% / 24.3%.
    expect(shares()).toEqual(["37.0%", "37.5%", "33.3%", "37.5%", "29.6%", "25.0%"]);
  });

  it("withholds ice time share when a player's ice time is unknown instead of counting 0", () => {
    render(
      <LineShareBars
        lines={[
          { label: "L1", players: [skater(1, { TOISeconds: 9_000, numGames: 10 })] },
          { label: "L2", players: [skater(2, { TOISeconds: undefined, numGames: 10 })] },
        ]}
      />
    );

    // The old code read L2 as 0 s, so L1 showed 100.0% and L2 0.0%.
    expect(shares()).toEqual(["—", "50.0%", "—", "50.0%"]);
    expect(screen.getByText(/Ice time share is unavailable/)).toBeTruthy();
  });

  it("on the 5v5 board, compares lines by each unit's 5v5 time together in the last game", () => {
    // Equal all-strength TOI per game: the legacy measure would show 33.3% each.
    const trio = (first: number) =>
      [first, first + 1, first + 2].map((id) => skater(id, { TOISeconds: 9_000, numGames: 10 }));
    render(
      <LineShareBars
        lineSource="five_on_five_observed"
        lines={[
          { label: "L1", players: trio(1), fiveOnFiveSeconds: 600 },
          { label: "L2", players: trio(4), fiveOnFiveSeconds: 300 },
          { label: "L3", players: trio(7), fiveOnFiveSeconds: 100 },
        ]}
      />
    );

    expect(shares()).toEqual(["60.0%", "33.3%", "30.0%", "33.3%", "10.0%", "33.3%"]);
    expect(screen.getAllByText("5v5 time share")).toHaveLength(3);
    expect(screen.getByText(/5v5 time together in the last game/)).toBeTruthy();
    cleanup();

    // A line on the board without its 5v5 time withholds the share, never 0.
    render(
      <LineShareBars
        lineSource="five_on_five_observed"
        lines={[
          { label: "L1", players: trio(1), fiveOnFiveSeconds: 600 },
          { label: "L2", players: trio(4), fiveOnFiveSeconds: null },
        ]}
      />
    );
    expect(shares()).toEqual(["—", "50.0%", "—", "50.0%"]);
    expect(screen.getByText(/5v5 time share is unavailable/)).toBeTruthy();
  });
});

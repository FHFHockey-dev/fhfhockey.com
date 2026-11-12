import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TopAddsWatchlist from "components/forge-command-center/TopAddsWatchlist";

afterEach(cleanup);

const moduleOf = <T,>(data: T) => ({
  status: "ready" as const, data, requestedDate: "2026-03-14", resolvedDate: "2026-03-14",
  fallbackApplied: false, message: null, error: null, contract: { id: "x", label: "x" } as never
});

describe("Top Adds watchlist on unconditional expected points (decision 132)", () => {
  it("ranks a healthy add above a day-to-day one and labels the latter 'if he plays'", () => {
    render(
      <TopAddsWatchlist
        module={moduleOf({
          forgePlayers: {
            data: [
              { player_id: 1, player_name: "DTD Star", team_name: "New Jersey Devils", position: "C",
                g: 0.9, a: 1, pts: 1.9, ppp: 0.6, sog: 4, hit: 1, blk: 1, uncertainty: 0.2,
                availability: { state: "uncertain", label: "day-to-day: participation probability not qualified" } },
              { player_id: 2, player_name: "Healthy Depth", team_name: "New Jersey Devils", position: "C",
                g: 0.1, a: 0.1, pts: 0.2, ppp: 0, sog: 1.5, hit: 1, blk: 0.5, uncertainty: 0.2 }
            ]
          },
          ownershipTrends: {
            success: true,
            risers: [
              { playerId: 1, name: "DTD Star", latest: 40, delta: 9, teamAbbrev: "NJD", sparkline: [] },
              { playerId: 2, name: "Healthy Depth", latest: 40, delta: 1, teamAbbrev: "NJD", sparkline: [] }
            ],
            fallers: []
          },
          ownershipSnapshots: null
        }) as never}
        position="all"
        addMode="tonight"
        playerHref={(id) => `/forge/player/${id}`}
      />
    );

    const names = screen.getAllByText(/^(DTD Star|Healthy Depth)$/).map((node) => node.textContent);
    expect(names).toEqual(["Healthy Depth", "DTD Star"]);
    const dtdRow = screen.getByText("DTD Star").closest("a")!.parentElement!;
    expect(dtdRow.textContent).toContain("if he plays");
    expect(dtdRow.textContent).toContain("inc.");
  });
});

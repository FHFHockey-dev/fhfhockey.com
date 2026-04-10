import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LineShareBars from "./LineShareBars";

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

    expect(screen.getByText("Recent Line Share")).toBeTruthy();
    expect(screen.getByText("L1")).toBeTruthy();
    expect(screen.getByText("L2")).toBeTruthy();
    expect(screen.getAllByText(/Timeshare|Goal Share/).length).toBeGreaterThan(1);
  });
});

import { describe, expect, it } from "vitest";

import type { TeamDataWithTotals } from "lib/NHL/types";
import {
  buildFourWeekDetailAverages,
  buildFourWeekDetailCells,
  getFourWeekNumbers,
} from "./fourWeekGridViews";

const team = (
  teamId: number,
  weeks: TeamDataWithTotals["weeks"],
): TeamDataWithTotals => ({
  teamId,
  teamAbbreviation: `T${teamId}`,
  weeks,
  totals: {
    gamesPlayed: weeks.reduce((sum, week) => sum + week.gamesPlayed, 0),
    offNights: weeks.reduce((sum, week) => sum + week.offNights, 0),
    opponents: weeks.flatMap((week) => week.opponents),
  },
  avgOpponentPointPct: 0.5,
});

describe("four-week grid alternate view", () => {
  const teams = [
    team(1, [
      {
        weekNumber: 2,
        gamesPlayed: 4,
        offNights: 2,
        opponents: [{ abbreviation: "BOS", teamId: 6 }],
      },
      {
        weekNumber: 1,
        gamesPlayed: 3,
        offNights: 1,
        opponents: [{ abbreviation: "NYR", teamId: 3 }],
      },
    ]),
    team(2, [
      {
        weekNumber: 1,
        gamesPlayed: 5,
        offNights: 3,
        opponents: [],
      },
    ]),
  ];

  it("derives a stable, bounded chronological week contract", () => {
    expect(getFourWeekNumbers(teams)).toEqual([1, 2]);
  });

  it("fills missing team weeks explicitly and preserves opponent context", () => {
    expect(buildFourWeekDetailCells(teams[1], [1, 2])).toEqual([
      {
        weekNumber: 1,
        gamesPlayed: 5,
        offNights: 3,
        opponents: [],
      },
      {
        weekNumber: 2,
        gamesPlayed: 0,
        offNights: 0,
        opponents: [],
      },
    ]);
    expect(buildFourWeekDetailCells(teams[0], [1])[0].opponents).toEqual([
      "NYR",
    ]);
  });

  it("calculates per-week league averages without hiding zero-game teams", () => {
    expect(buildFourWeekDetailAverages(teams, [1, 2])).toEqual([
      { weekNumber: 1, gamesPlayed: 4, offNights: 2 },
      { weekNumber: 2, gamesPlayed: 2, offNights: 1 },
    ]);
  });
});

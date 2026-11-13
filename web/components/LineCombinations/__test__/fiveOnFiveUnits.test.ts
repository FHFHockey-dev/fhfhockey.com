import { describe, expect, it } from "vitest";

import {
  LINES_FIVE_ON_FIVE_ENABLED,
  aggregateObservedUnits,
  assignDisjointUnits,
  buildFiveOnFiveLines,
  type ObservedUnit,
  type TeamUnitToiReaderRow
} from "../fiveOnFiveUnits";

const unit = (playerIds: number[], sharedSeconds: number): ObservedUnit => ({
  playerIds,
  sharedSeconds
});
const ids = (units: ObservedUnit[]) => units.map((entry) => entry.playerIds);

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])
  );
}

describe("assignDisjointUnits (decision 137)", () => {
  it("keeps the higher shared-TOI unit when two share a player and fills the rest without reuse", () => {
    const observed = [
      unit([1, 2, 3], 300),
      unit([3, 4, 5], 250), // shares player 3 with the top unit
      unit([4, 5, 6], 200),
      unit([7, 8, 9], 100),
      unit([10, 11, 12], 90)
    ];
    const chosen = assignDisjointUnits(observed, 4);
    expect(ids(chosen)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12]
    ]);
    const slotted = chosen.flatMap((entry) => entry.playerIds);
    expect(new Set(slotted).size).toBe(slotted.length);
  });

  it("resolves equal shared TOI deterministically by player ids", () => {
    expect(ids(assignDisjointUnits([unit([4, 5, 6], 120), unit([1, 7, 8], 120)], 2))).toEqual([
      [1, 7, 8],
      [4, 5, 6]
    ]);
    // Tied units that share a player: the lower ids win the slot.
    expect(ids(assignDisjointUnits([unit([1, 4, 5], 120), unit([1, 2, 3], 120)], 2))).toEqual([
      [1, 2, 3]
    ]);
  });

  it("does not depend on input order", () => {
    const observed = [
      unit([1, 2, 3], 300),
      unit([3, 4, 5], 250),
      unit([4, 5, 6], 250),
      unit([2, 7, 8], 120),
      unit([7, 8, 9], 120)
    ];
    const expected = ids(assignDisjointUnits(observed, 4));
    expect(expected).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]);
    for (const order of permutations(observed)) {
      expect(ids(assignDisjointUnits(order, 4))).toEqual(expected);
    }
  });
});

describe("aggregateObservedUnits", () => {
  const row = (overrides: Partial<TeamUnitToiReaderRow>): TeamUnitToiReaderRow => ({
    game_id: 1,
    team_id: 22,
    snapshot_date: "2026-11-10",
    unit_type: "forward_line",
    player_ids: [1, 2, 3],
    player_count: 3,
    unit_toi_seconds: 300,
    coverage_status: "complete",
    ...overrides
  });

  it("converts pooled player-seconds to clock seconds and sums units across games", () => {
    const { units } = aggregateObservedUnits(
      [row({}), row({ game_id: 2, player_ids: [3, 2, 1], unit_toi_seconds: 150 })],
      "forward_line"
    );
    expect(units).toEqual([unit([1, 2, 3], 150)]);
  });

  it("reads only the latest snapshot and excludes incomplete team-games", () => {
    const { units, excludedTeamGames } = aggregateObservedUnits(
      [
        row({ snapshot_date: "2026-11-09", unit_toi_seconds: 999 }),
        row({}),
        row({ game_id: 2, unit_toi_seconds: 600, coverage_status: "partial" })
      ],
      "forward_line"
    );
    expect(units).toEqual([unit([1, 2, 3], 100)]);
    expect(excludedTeamGames).toBe(1);
  });

  it("returns null lines when no complete 5v5 rows exist", () => {
    expect(buildFiveOnFiveLines([row({ coverage_status: "source_gap" })])).toBeNull();
  });

  it("stays off until the team_unit_toi rebuild is approved", () => {
    expect(LINES_FIVE_ON_FIVE_ENABLED).toBe(false);
  });
});

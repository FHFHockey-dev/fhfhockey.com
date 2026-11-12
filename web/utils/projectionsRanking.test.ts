import { describe, expect, it } from "vitest";
import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { assignGlobalRanks, injectRanks } from "./projectionsRanking";

const SKATER_POINTS = { GOALS: 2, ASSISTS: 1 };
const GOALIE_POINTS = { WINS_GOALIE: 4 };

function skater(
  playerId: number,
  displayPosition: string,
  goals: [number | null, number | null],
  assists: [number | null, number | null] = [0, 0]
): ProcessedPlayer {
  const projected =
    goals[0] == null && assists[0] == null
      ? null
      : (goals[0] ?? 0) * 2 + (assists[0] ?? 0);
  const actual =
    goals[1] == null && assists[1] == null
      ? null
      : (goals[1] ?? 0) * 2 + (assists[1] ?? 0);
  return {
    playerId,
    fullName: `Skater ${playerId}`,
    displayTeam: "TST",
    displayPosition,
    combinedStats: {
      GOALS: { projected: goals[0], actual: goals[1] },
      ASSISTS: { projected: assists[0], actual: assists[1] }
    } as any,
    fantasyPoints: {
      projected,
      actual,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null
    }
  };
}

function goalie(
  playerId: number,
  wins: [number | null, number | null]
): ProcessedPlayer {
  return {
    playerId,
    fullName: `Goalie ${playerId}`,
    displayTeam: "TST",
    displayPosition: "G",
    combinedStats: {
      WINS_GOALIE: { projected: wins[0], actual: wins[1] }
    } as any,
    fantasyPoints: {
      projected: wins[0] == null ? null : wins[0] * 4,
      actual: wins[1] == null ? null : wins[1] * 4,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null
    }
  };
}

const options = {
  sharedPointsScoring: true,
  skaterPointValues: SKATER_POINTS,
  goaliePointValues: GOALIE_POINTS
};

function ranksById(players: ProcessedPlayer[]) {
  return Object.fromEntries(
    players.map((p) => [
      p.playerId,
      {
        projectedRank: p.projectedRank ?? null,
        actualRank: p.actualRank ?? null,
        projectedPositionRank: p.projectedPositionRank ?? null,
        actualPositionRank: p.actualPositionRank ?? null,
        rankPosition: p.rankPosition ?? null
      }
    ])
  );
}

describe("projections ranks (W3-1 D2, decision 115)", () => {
  it("gives tied players the same competition rank and leaves unknown values unranked", () => {
    // Projected FP: 1 → 20, 2 → 20, 3 → null, 4 → -2 (a supported negative).
    // Actual FP: 1 → 10, 2 → null, 3 → 10, 4 → 4.
    const skaters = [
      skater(1, "C", [10, 5]),
      skater(2, "C", [10, null], [0, null]),
      skater(3, "LW", [null, 5], [null, 0]),
      skater(4, "D", [-1, 2])
    ];
    const ranks = ranksById(assignGlobalRanks(skaters, [], options));
    expect(ranks[1].projectedRank).toBe(1);
    expect(ranks[2].projectedRank).toBe(1);
    expect(ranks[4].projectedRank).toBe(3); // competition rank: 1, 1, 3
    expect(ranks[3].projectedRank).toBeNull(); // null is not 0
    expect(ranks[1].actualRank).toBe(1);
    expect(ranks[3].actualRank).toBe(1);
    expect(ranks[4].actualRank).toBe(3);
    expect(ranks[2].actualRank).toBeNull();
  });

  it("does not depend on input order", () => {
    const players = () => [
      skater(1, "C", [10, 3]),
      skater(2, "C", [10, 3]),
      skater(3, "D", [8, 9]),
      skater(4, "RW", [null, 1], [null, 0])
    ];
    const forward = ranksById(assignGlobalRanks(players(), [], options));
    const reversed = ranksById(
      assignGlobalRanks(players().reverse(), [], options)
    );
    expect(reversed).toEqual(forward);
    expect(forward[1].actualRank).toBe(forward[2].actualRank);
  });

  it("returns new player objects and never mutates the caller's players", () => {
    const skaters = [skater(1, "C", [10, 3]), skater(2, "D", [5, 6])];
    const goalies = [goalie(9, [30, 2])];
    const before = JSON.stringify([skaters, goalies]);
    const ranked = assignGlobalRanks(skaters, goalies, options);
    expect(JSON.stringify([skaters, goalies])).toBe(before);
    expect(ranked.every((p) => !skaters.includes(p) && !goalies.includes(p))).toBe(true);
  });

  it("ranks skaters and goalies together on one points basis and within primary position", () => {
    const ranks = ranksById(
      assignGlobalRanks(
        [skater(1, "C,LW", [30, 10]), skater(2, "LW", [20, 12]), skater(3, "C", [10, 1])],
        [goalie(9, [12, 4])],
        options
      )
    );
    // Projected FP: 60, 40, 20; goalie 48.
    expect(ranks[1]).toMatchObject({ projectedRank: 1, projectedPositionRank: 1, rankPosition: "C" });
    expect(ranks[9]).toMatchObject({ projectedRank: 2, projectedPositionRank: 1, rankPosition: "G" });
    expect(ranks[2]).toMatchObject({ projectedRank: 3, projectedPositionRank: 1, rankPosition: "LW" });
    expect(ranks[3]).toMatchObject({ projectedRank: 4, projectedPositionRank: 2, rankPosition: "C" });
  });

  it("withholds the overall rank when skaters and goalies are not on one scoring basis, keeping position ranks", () => {
    const ranks = ranksById(
      assignGlobalRanks(
        [skater(1, "C", [30, 10]), skater(2, "C", [20, 12])],
        [goalie(9, [12, 4])],
        { ...options, sharedPointsScoring: false }
      )
    );
    expect(ranks[1].projectedRank).toBeNull();
    expect(ranks[9].projectedRank).toBeNull();
    expect(ranks[1].projectedPositionRank).toBe(1);
    expect(ranks[2].projectedPositionRank).toBe(2);
    expect(ranks[9].projectedPositionRank).toBe(1);
  });

  it("withholds ranks for a player whose scored inputs are incomplete", () => {
    // Player 2 has goals but no assists projection: a partial subtotal is not comparable.
    const ranks = ranksById(
      assignGlobalRanks(
        [skater(1, "C", [10, 3]), skater(2, "C", [30, 3], [null, 0])],
        [],
        options
      )
    );
    expect(ranks[2].projectedRank).toBeNull();
    expect(ranks[2].projectedPositionRank).toBeNull();
    expect(ranks[1].projectedRank).toBe(1);
    expect(ranks[2].actualRank).toBe(1);
  });

  it("injects ranks into table rows without crashing on players missing from the ranked set", () => {
    const ranked = assignGlobalRanks([skater(1, "C", [10, 3])], [], options);
    const rows = injectRanks(
      [skater(1, "C", [10, 3]), skater(2, "C", [5, 1])],
      ranked
    ) as ProcessedPlayer[];
    expect(rows[0].projectedRank).toBe(1);
    expect(rows[1].projectedRank).toBeNull();
  });
});

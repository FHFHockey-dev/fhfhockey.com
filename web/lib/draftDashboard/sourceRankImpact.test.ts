import { describe, expect, it } from "vitest";
import {
  calculateSourceRankImpacts,
  rankProjectionPlayers
} from "./sourceRankImpact";

describe("projection source rank impact", () => {
  it("ranks skaters and goalies independently", () => {
    expect(
      rankProjectionPlayers([
        { playerId: "s1", displayPosition: "C", fantasyPoints: { projected: 20 } },
        { playerId: "s2", displayPosition: "D", fantasyPoints: { projected: 10 } },
        { playerId: "g1", displayPosition: "G", fantasyPoints: { projected: 5 } }
      ])
    ).toEqual({ s1: 1, s2: 2, g1: 1 });
  });

  it("reports only material moves with direction and exact ranks", () => {
    expect(
      calculateSourceRankImpacts(
        { a: 8, b: 4, c: 2 },
        { a: 3, b: 6, c: 9 },
        3
      )
    ).toEqual({
      a: { previousRank: 8, currentRank: 3, delta: 5 },
      c: { previousRank: 2, currentRank: 9, delta: -7 }
    });
  });

  it("gives tied projections the same competition rank, whatever the input order or ids", () => {
    const players = [
      { playerId: "b", displayPosition: "C", fantasyPoints: { projected: 10 } },
      { playerId: "a", displayPosition: "C", fantasyPoints: { projected: 10 } },
      { playerId: "c", displayPosition: "C", fantasyPoints: { projected: 4 } }
    ];
    expect(rankProjectionPlayers(players)).toEqual({ a: 1, b: 1, c: 3 });
    expect(rankProjectionPlayers([...players].reverse())).toEqual({ a: 1, b: 1, c: 3 });
  });
});

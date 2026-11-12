import { describe, expect, it } from "vitest";

import {
  extractTopAddsUncertainty,
  rankTopAddsCandidates,
  scoreTopAddsCandidate,
  toTopAddsProjection,
  type TopAddsCandidateInput
} from "./topAddsRanking";

function makeCandidate(
  overrides: Partial<TopAddsCandidateInput>
): TopAddsCandidateInput {
  return {
    playerId: 1,
    name: "Test Skater",
    team: "NJD",
    teamAbbr: "NJD",
    position: "C",
    headshot: null,
    ownership: 50,
    ownershipTimeline: [],
    delta: 4,
    goals: 0.3,
    assists: 0.4,
    projectionPts: 0.7,
    ppp: 0.2,
    sog: 2.5,
    hit: 1,
    blk: 0.5,
    uncertainty: 0.3,
    scheduleGamesRemaining: 3,
    scheduleOffNightsRemaining: 1,
    scheduleLabel: null,
    ...overrides
  };
}

// FHFH default: 3(.3) + 2(.4) + .2 + .2(2.5) + .2(1) + .25(.5) = 2.725 per game.
const PER_GAME = 2.725;

describe("Top Adds expected points (decision 118, W3-2 D3)", () => {
  it("scores expected FHFH points: one game tonight, games left this week", () => {
    expect(scoreTopAddsCandidate(makeCandidate({}), "tonight")).toMatchObject({
      status: "complete", perGamePoints: 2.73, games: 1, total: 2.73
    });
    expect(scoreTopAddsCandidate(makeCandidate({}), "week").total).toBeCloseTo(3 * PER_GAME, 2);
  });

  it("keeps demand and ownership out of the objective (separate columns)", () => {
    const a = scoreTopAddsCandidate(makeCandidate({ delta: 9, ownership: 5 }), "tonight");
    const b = scoreTopAddsCandidate(makeCandidate({ delta: -3, ownership: null }), "tonight");
    expect(a.total).toBe(b.total);
  });

  it("makes a missing goals head incomplete and ranks it below any complete row", () => {
    const ranked = rankTopAddsCandidates(
      [
        makeCandidate({ playerId: 1, name: "Missing Head", goals: null, delta: 12, ownership: 30 }),
        makeCandidate({ playerId: 2, name: "Small Complete", goals: 0, assists: 0.1, ppp: 0, sog: 1, hit: 0, blk: 0, delta: 0 })
      ],
      "tonight"
    );
    expect(ranked.map((row) => row.name)).toEqual(["Small Complete", "Missing Head"]);
    expect(ranked[1]?.score).toMatchObject({ status: "incomplete", total: null, missing: ["goals"] });
  });

  it("marks week mode incomplete when the games left are unknown", () => {
    expect(scoreTopAddsCandidate(makeCandidate({ scheduleGamesRemaining: null }), "week"))
      .toMatchObject({ status: "incomplete", missing: ["schedule"], total: null });
  });

  it("ranks the same way whatever the input order (rule 20)", () => {
    const rows = [
      makeCandidate({ playerId: 3, delta: 1 }),
      makeCandidate({ playerId: 1, delta: 1 }),
      makeCandidate({ playerId: 2, delta: 1, ownership: null })
    ];
    const forward = rankTopAddsCandidates(rows, "tonight").map((row) => row.playerId);
    const reversed = rankTopAddsCandidates([...rows].reverse(), "tonight").map((row) => row.playerId);
    expect(forward).toEqual([1, 3, 2]);
    expect(reversed).toEqual(forward);
  });

  it("adapts API rows without zero-filling and reads object uncertainty without NaN", () => {
    const uncertainty = { model: { skater_selection: { role_continuity: { volatility_index: 0.4 } } } };
    expect(toTopAddsProjection({ g: null, a: 0.5, pts: null, ppp: 0.2, sog: 3, hit: undefined, blk: 1, uncertainty }))
      .toEqual({ goals: null, assists: 0.5, projectionPts: null, ppp: 0.2, sog: 3, hit: null, blk: 1, uncertainty: 0.4, availability: null });
    expect(extractTopAddsUncertainty({})).toBeNull();
    expect(extractTopAddsUncertainty(Number.NaN)).toBeNull();
  });
});

describe("Top Adds on unconditional expected points (decision 132, L9c)", () => {
  const out = { state: "confirmed_out", label: "scratched / not expected to dress" };
  const dtd = { state: "uncertain", label: "day-to-day: participation probability not qualified" };

  it("scores a confirmed-out player 0 tonight and keeps his line as 'if he plays'", () => {
    const score = scoreTopAddsCandidate(makeCandidate({ availability: out }), "tonight");
    expect(score).toMatchObject({ status: "complete", total: 0, perGamePoints: 2.73, games: 1 });
    expect(score.lineLabel).toBe("If he plays · scratched / not expected to dress");
  });

  it("makes a confirmed-out player incomplete for the week (other games unknown)", () => {
    expect(scoreTopAddsCandidate(makeCandidate({ availability: out }), "week"))
      .toMatchObject({ status: "incomplete", total: null, missing: ["availability"] });
  });

  it("never ranks an uncertain or unknown player on his full line", () => {
    const ranked = rankTopAddsCandidates([
      makeCandidate({ playerId: 1, name: "DTD Star", goals: 1, assists: 1, availability: dtd }),
      makeCandidate({ playerId: 2, name: "Unknown Return", availability: { state: "unknown", label: "participation unknown" } }),
      makeCandidate({ playerId: 3, name: "Healthy Depth", goals: 0, assists: 0.1, ppp: 0, sog: 1, hit: 0, blk: 0 }),
    ], "tonight");
    expect(ranked.map((row) => row.name)).toEqual(["Healthy Depth", "DTD Star", "Unknown Return"]);
    expect(ranked[1]?.score).toMatchObject({ status: "incomplete", total: null, missing: ["availability"],
      lineLabel: "If he plays · day-to-day: participation probability not qualified" });
  });

  it("reads availability from the API row; a projected lineup or an old run is unchanged", () => {
    expect(toTopAddsProjection({ availability: { state: "uncertain", label: "x", game_id: 1 } }).availability)
      .toEqual({ state: "uncertain", label: "x" });
    expect(toTopAddsProjection({}).availability).toBeNull();
    const lineup = scoreTopAddsCandidate(makeCandidate({ availability: { state: "projected_lineup", label: "in projected lineup" } }), "tonight");
    expect(lineup).toMatchObject({ status: "complete", total: 2.73, lineLabel: null });
  });
});

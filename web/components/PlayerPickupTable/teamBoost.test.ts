import { describe, expect, it } from "vitest";

import { buildTeamBoost, teamBoostFor } from "./teamBoost";

const team = (teamAbbreviation: string, gamesPlayed: number, weekScore?: number) => ({
  teamAbbreviation, gamesPlayed, offNights: 0, avgOpponentPointPct: 0.5, weekScore
});

describe("pickup team boost (W1 P0 #29, decision 56)", () => {
  it("excludes the −100 idle marker from normalisation and keeps idle teams visible", () => {
    const withIdle = buildTeamBoost([team("A", 2, 10), team("B", 2, 11), team("IDL", 0, -100)]);
    const without = buildTeamBoost([team("A", 2, 10), team("B", 2, 11)]);
    expect(withIdle.get("IDL")).toEqual({ status: "idle", multiplier: null });
    expect(withIdle.get("A")).toEqual(without.get("A"));
    expect(withIdle.get("B")).toEqual(without.get("B"));
  });

  it("does not blow a one-point schedule difference up to the full ±25% spread", () => {
    const boost = buildTeamBoost([team("A", 2, 10), team("B", 2, 11)]);
    expect(boost.get("B")!.multiplier! - boost.get("A")!.multiplier!).toBeCloseTo(0.025, 12);
  });

  it("ties identical schedules and treats a missing schedule as unknown, not idle", () => {
    const boost = buildTeamBoost([team("A", 1, 4), team("B", 1, 4), team("NOSCORE", 1)]);
    expect(boost.get("A")!.multiplier).toBe(1);
    expect(boost.get("B")!.multiplier).toBe(1);
    expect(boost.get("NOSCORE")).toEqual({ status: "unknown", multiplier: 1 });
    expect(teamBoostFor(boost, "MISSING")).toEqual({ status: "unknown", multiplier: 1 });
  });
});

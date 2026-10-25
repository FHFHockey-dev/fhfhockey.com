import { describe, expect, it } from "vitest";
import { STREAK, streakOf } from "./streak";
import type { SharePlayerRecent } from "./types";

type Skater = Extract<SharePlayerRecent, { kind: "skater" }>;
// A neutral skater: 2 points in 5 GP over 2 games, TOI and PP TOI flat, no specialist rates: no streak.
const skater = (patch: Partial<Skater> = {}, group: "F" | "D" = "F") => ({ group, recent: { kind: "skater" as const, games: 5, through: "2026-10-24", goals: 1, assists: 1, points: 2, shots: 10,
  hitsPerGame: 1, blocksPerGame: 1, toiSeconds: 1000, ppPoints: 1, line: null, ppUnit: null, toiSeasonSeconds: 1000, pointGames: 2, toiPreSeconds: 1000, ppToiSeconds: 100, ppToiPreSeconds: 100, ...patch } });
const goalie = (qualityStarts: number, saves: number, shotsAgainst: number, games = 5) => ({ group: "G" as const, recent: { kind: "goalie" as const, games, through: "2026-10-24", wins: 3, saves, shotsAgainst, goalsAgainst: shotsAgainst - saves, qualityStarts, shutouts: 0 } });
const kind = (player: Parameters<typeof streakOf>[0], context: Parameters<typeof streakOf>[1] = "pickup") => streakOf(player, context)?.kind ?? null;

describe("streak thresholds (TJ, ticket 18)", () => {
  it("documents TJ's choices in one config", () => {
    expect(STREAK.hot).toEqual({ pointGames: 4, pointsPerGame: 0.85, toiRise: 0.15, ppToiRise: 0.35 });
    expect(STREAK.cold).toEqual({ pointGames: 1, pointsPerGame: 0.25, toiDrop: 0.15, ppToiDrop: 0.35 });
    expect(STREAK.specialists).toEqual({ hitsPerGame: 2, blocksPerGame: 2, shotsPerGame: 2.5, ppPointsPerGame: 0.5 });
    expect(kind(skater())).toBeNull();
  });

  it("points in 4 of 5 games is hot; 3 of 5 is not (games with a point, not total points)", () => {
    expect(streakOf(skater({ pointGames: 4 }), "pickup")).toEqual({ kind: "hot", reasons: ["4/5 P"] });
    expect(kind(skater({ pointGames: 3, points: 4 }))).toBeNull();
    // Unknown per-game points never fire either way.
    expect(kind(skater({ pointGames: null, points: 2 }))).toBeNull();
  });

  it("0.85 P/GP or more is hot: over 5 GP that is 5 points (1.0); 4 points (0.80) is not", () => {
    expect(streakOf(skater({ points: 5, pointGames: 3 }), "tier")).toEqual({ kind: "hot", reasons: ["1.0 P/GP"] });
    expect(kind(skater({ points: 4, pointGames: 3 }))).toBeNull();
    // The comparator itself is inclusive at exactly 0.85 (e.g. a shorter span in a future config).
    expect(kind({ group: "F", recent: { ...skater().recent, games: 20, points: 17, pointGames: 3 } })).toBe("hot");
  });

  it("TOI up 15% or more vs the pre-L5 average is hot; 14.9% is not", () => {
    expect(streakOf(skater({ toiSeconds: 1150, toiPreSeconds: 1000 }), "pickup")).toEqual({ kind: "hot", reasons: ["TOI +15%"] });
    expect(kind(skater({ toiSeconds: 1149, toiPreSeconds: 1000 }))).toBeNull();
    expect(kind(skater({ toiSeconds: 1500, toiPreSeconds: null }))).toBeNull();
  });

  it("PP TOI up 35% or more is hot; 34.9% is not; a tiny pre-L5 baseline never fires", () => {
    expect(streakOf(skater({ ppToiSeconds: 135, ppToiPreSeconds: 100 }), "pickup")).toEqual({ kind: "hot", reasons: ["PP TOI +35%"] });
    expect(kind(skater({ ppToiSeconds: 134.9, ppToiPreSeconds: 100 }))).toBeNull();
    expect(kind(skater({ ppToiSeconds: 90, ppToiPreSeconds: STREAK.ppToiMinBaselineSeconds - 1 }))).toBeNull();
  });

  it("specialist rates are strictly greater than, and only on the Specialists card", () => {
    expect(kind(skater({ hitsPerGame: 2.0 }), "specialist")).toBeNull();
    expect(streakOf(skater({ hitsPerGame: 2.01 }), "specialist")).toEqual({ kind: "hot", reasons: ["2.0 HIT/GP"] });
    expect(kind(skater({ hitsPerGame: 2.01 }), "pickup")).toBeNull();
    expect(kind(skater({ blocksPerGame: 2.0 }), "specialist")).toBeNull();
    expect(kind(skater({ blocksPerGame: 2.2 }), "specialist")).toBe("hot");
    expect(kind(skater({ shots: 12.5 }), "specialist")).toBeNull();
    expect(kind(skater({ shots: 13 }), "specialist")).toBe("hot");
    expect(kind(skater({ ppPoints: 2.5 }), "specialist")).toBeNull();
    expect(kind(skater({ ppPoints: 3, points: 3 }), "specialist")).toBe("hot");
    // Missing L5 hits (as live today) never fires.
    expect(kind(skater({ hitsPerGame: null, blocksPerGame: null }), "specialist")).toBeNull();
  });

  it("cold mirrors hot: ≤ 1 of 5, ≤ 0.25 P/GP, TOI or PP TOI down; hot wins when both apply", () => {
    expect(streakOf(skater({ pointGames: 1, points: 2 }), "pickup")).toEqual({ kind: "cold", reasons: ["1/5 P"] });
    expect(streakOf(skater({ points: 1, pointGames: 2 }), "pickup")).toEqual({ kind: "cold", reasons: ["0.2 P/GP"] });
    expect(kind(skater({ points: 2, pointGames: 2 }))).toBeNull();
    expect(streakOf(skater({ toiSeconds: 850, toiPreSeconds: 1000 }), "pickup")).toEqual({ kind: "cold", reasons: ["TOI −15%"] });
    expect(kind(skater({ toiSeconds: 851, toiPreSeconds: 1000 }))).toBeNull();
    expect(streakOf(skater({ ppToiSeconds: 65, ppToiPreSeconds: 100 }), "pickup")).toEqual({ kind: "cold", reasons: ["PP TOI −35%"] });
    expect(kind(skater({ toiSeconds: 1200, toiPreSeconds: 1000, pointGames: 0, points: 0 }))).toBe("hot");
  });

  it("shows nothing with fewer than 5 recent games or no recent form", () => {
    expect(kind(skater({ games: 4, pointGames: 4, points: 8 }))).toBeNull();
    expect(kind({ group: "F", recent: null })).toBeNull();
    expect(kind(goalie(5, 140, 150, 4))).toBeNull();
  });

  it("goalies (TJ: goalies too; proposed rules): ≥ 4 of 5 quality starts or ≥ .930 SV% hot; ≤ 1 QS or ≤ .870 cold", () => {
    expect(streakOf(goalie(4, 130, 145), "pickup")).toEqual({ kind: "hot", reasons: ["4/5 QS"] });
    expect(streakOf(goalie(3, 139.5, 150), "pickup")).toEqual({ kind: "hot", reasons: [".930 SV%"] });
    expect(kind(goalie(3, 139, 150))).toBeNull();
    expect(streakOf(goalie(1, 135, 150), "pickup")).toEqual({ kind: "cold", reasons: ["1/5 QS"] });
    expect(streakOf(goalie(2, 130.5, 150), "pickup")).toEqual({ kind: "cold", reasons: [".870 SV%"] });
    expect(kind(goalie(2, 131, 150))).toBeNull();
  });
});

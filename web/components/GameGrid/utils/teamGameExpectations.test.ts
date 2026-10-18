import { describe, expect, it } from "vitest";
import type { GameExpectationsResponse, GameExpectationTarget } from "lib/player-forecasts/gameExpectations";
import { overlappingCategories, summarizeTeamGameExpectations, TEAM_CATEGORY_TARGETS } from "./teamGameExpectations";

const asOf = "2026-10-21T15:00:00Z";
function target(expected: number | null, overrides: Partial<GameExpectationTarget> = {}): GameExpectationTarget {
  return {
    expected, conditional: null, basis: "unconditional_game", unit: "count",
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    sourceKind: null, sourceIds: ["src-1"], methodVersions: ["m1"], sourceWatermarks: ["w1"],
    cutoffAt: "2026-10-21T12:00:00Z", issuedAt: "2026-10-21T12:05:00Z", expiresAt: "2026-10-22T12:00:00Z",
    sources: [{ sourceId: "src-1", kind: "detailed", methodVersion: "m1", sourceWatermark: "w1",
      cutoffAt: "2026-10-21T12:00:00Z", issuedAt: "2026-10-21T12:05:00Z", expiresAt: "2026-10-22T12:00:00Z" }],
    participation: null, participationRevisionId: null, reasons: [], limitations: [], ...overrides
  };
}
function game(gameId: string, scheduledAt: string, goals: GameExpectationTarget) {
  return {
    gameId, date: scheduledAt.slice(0, 10), scheduledAt, team: "CAR", opponent: "FLA", homeTeam: "CAR", awayTeam: "FLA",
    scheduleRevision: "s1", rosterRevision: "r1", appearanceProbability: 0.9, startProbability: null,
    powerPlayRole: { value: null, status: "unavailable" as const, reason: "current_role_evidence_unavailable" as const, source: null },
    limitations: [], targets: { GOALS: goals, ASSISTS: target(0.4), PP_POINTS: target(0.2) }
  };
}
function player(playerId: string, games: ReturnType<typeof game>[], team = "CAR", playerClass: "skater" | "goalie" = "skater") {
  return {
    playerId, nhlPlayerId: Number(playerId), teamId: 12, name: playerId, team, playerClass, positions: ["C"],
    scheduledOpportunities: games.length, requestedGames: null, horizonComplete: true,
    expectedAppearances: null, expectedStarts: null, games, totals: {}, ratios: {}
  };
}
function response(players: ReturnType<typeof player>[]): GameExpectationsResponse {
  return {
    version: "forge-game-expectations-v1", readAsOf: asOf, manifestId: "m", baselineChecksum: "c",
    scope: { seasonId: 20262027, startDate: "2026-10-21", endDate: "2026-10-25", timeZone: "America/New_York", mode: "calendar", games: 3 },
    players, limitations: []
  };
}
const g1 = "2026-10-21T23:00:00Z", g2 = "2026-10-23T23:00:00Z";

describe("Game Grid adapter for shared FORGE game expectations", () => {
  it("sums covered player-game keys with original clocks", () => {
    const summary = summarizeTeamGameExpectations({
      response: response([
        player("1", [game("101", g1, target(0.3)), game("102", g2, target(0.5, { expiresAt: "2026-10-21T20:00:00Z" }))]),
        player("2", [game("101", g1, target(0)), game("102", g2, target(0.25, { cutoffAt: "2026-10-21T12:04:00Z" }))]),
        player("9", [game("101", g1, target(5))], "FLA"),
        player("8", [game("101", g1, target(5))], "CAR", "goalie")
      ]),
      team: "CAR", gameIds: ["101", "102"], asOf
    });
    expect(summary.G.status).toBe("available");
    expect(summary.G.knownPlayerSubtotal).toBeCloseTo(1.05);
    expect(summary.G.covered).toHaveLength(4);
    expect(summary.G.cutoffAt).toBe("2026-10-21T12:04:00Z");
    expect(summary.G.expiresAt).toBe("2026-10-21T20:00:00Z");
    expect(summary.SOG.status).toBe("unavailable");
    expect(summary.SOG.missing.every(({ reasons }) => reasons.includes("missing_target"))).toBe(true);
  });

  it("keeps partial, stale, unapproved, post-start and duplicate keys missing with reasons", () => {
    const summary = summarizeTeamGameExpectations({
      response: response([
        player("1", [game("101", g1, target(0.3)), game("102", g2, target(0.5, { expiresAt: "2026-10-21T14:00:00Z" }))]),
        player("2", [game("101", g1, target(0.2, { allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false } })),
          game("102", g2, target(0.2, { cutoffAt: "2026-10-24T00:00:00Z" }))]),
        player("3", [game("101", "2026-10-21T14:00:00Z", target(0.2))]),
        player("4", [game("101", g1, target(0.1)), game("101", g1, target(0.1))])
      ]),
      team: "CAR", gameIds: ["101", "102"], asOf
    });
    expect(summary.G.status).toBe("partial");
    expect(summary.G.knownPlayerSubtotal).toBeCloseTo(0.3);
    const reasons = Object.fromEntries(summary.G.missing.map(({ playerId, gameId, reasons }) => [`${playerId}/${gameId}`, reasons]));
    expect(reasons["1/102"]).toContain("expired");
    expect(reasons["2/101"]).toContain("use_not_approved");
    expect(reasons["2/102"]).toContain("unsafe_cutoff");
    expect(reasons["3/101"]).toContain("game_not_future");
    expect(reasons["3/102"]).toEqual(["game_not_in_reader"]);
    expect(reasons["4/101"]).toEqual(["duplicate_key"]);
    expect(summary.G.limitations.some((text) => text.includes("missing keys are not zero"))).toBe(true);
  });

  it("distinguishes no games, no reader and an empty team", () => {
    expect(summarizeTeamGameExpectations({ response: response([]), team: "CAR", gameIds: [], asOf }).G)
      .toMatchObject({ status: "no_games", knownPlayerSubtotal: 0 });
    expect(summarizeTeamGameExpectations({ response: null, team: "CAR", gameIds: ["101"], asOf }).G)
      .toMatchObject({ status: "unavailable", knownPlayerSubtotal: null });
    expect(summarizeTeamGameExpectations({ response: response([]), team: "CAR", gameIds: ["101"], asOf }).G.limitations)
      .toContain("No skaters for this team in the shared reader.");
  });

  it("maps categories to native targets and refuses to treat G, A and PPP as disjoint", () => {
    expect(TEAM_CATEGORY_TARGETS.PPP).toBe("PP_POINTS");
    expect(overlappingCategories(["G", "A", "SOG"])).toEqual(["G", "A"]);
    expect(overlappingCategories(["PPP", "G"])).toEqual(["PPP", "G"]);
    expect(overlappingCategories(["G", "SOG", "HIT", "BLK", "PIM"])).toEqual([]);
  });
});

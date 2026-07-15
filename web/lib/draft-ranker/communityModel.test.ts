import { describe, expect, it } from "vitest";

import {
  computeCommunityRanking,
  deduplicateCommunityPreferences,
  type CommunityCandidate,
  type CommunityPairPreference,
} from "./communityModel";

function candidates(count: number): CommunityCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    fhfhPlayerId: index + 1,
    marketRank: index + 1,
    priorState: "market_ranked" as const,
  }));
}

function preference(args: {
  user: string;
  winner: number;
  loser: number;
  sequence?: number;
}): CommunityPairPreference {
  const sequence = args.sequence ?? 1;
  return {
    comparisonId: `${args.user}-${args.winner}-${args.loser}-${sequence}`,
    userKey: args.user,
    lowPlayerId: Math.min(args.winner, args.loser),
    highPlayerId: Math.max(args.winner, args.loser),
    preferredPlayerId: args.winner,
    establishedAt: `2026-07-${String(sequence).padStart(2, "0")}T00:00:00.000Z`,
    communityEligible: true,
    consentActive: true,
    rateEligible: true,
  };
}

describe("Community Ranking v1", () => {
  it("deduplicates one latest preference per pseudonymous user and canonical pair", () => {
    const result = deduplicateCommunityPreferences([
      preference({ user: "u1", winner: 1, loser: 2, sequence: 1 }),
      preference({ user: "u1", winner: 2, loser: 1, sequence: 2 }),
      preference({ user: "u2", winner: 1, loser: 2, sequence: 1 }),
    ]);
    expect(result.accepted).toHaveLength(2);
    expect(result.deduplicatedCount).toBe(1);
    expect(
      result.accepted.find((row) => row.userKey === "u1")?.preferredPlayerId,
    ).toBe(2);
  });

  it("rejects ineligible, revoked, rate-excluded, moderated, malformed, and unknown-player evidence", () => {
    const rows = [
      {
        ...preference({ user: "u1", winner: 1, loser: 2 }),
        communityEligible: false,
      },
      {
        ...preference({ user: "u2", winner: 1, loser: 2 }),
        consentActive: false,
      },
      {
        ...preference({ user: "u3", winner: 1, loser: 2 }),
        rateEligible: false,
      },
      {
        ...preference({ user: "u4", winner: 1, loser: 2 }),
        moderationExcluded: true,
      },
      preference({ user: "u5", winner: 1, loser: 99 }),
    ];
    const result = computeCommunityRanking({
      candidates: candidates(3),
      preferences: rows,
    });
    expect(result.acceptedComparisonCount).toBe(0);
    expect(result.excludedComparisonCount).toBe(5);
  });

  it("accounts for opponent strength instead of sorting by raw win count", () => {
    const result = computeCommunityRanking({
      candidates: candidates(6).map((candidate) => ({
        ...candidate,
        marketRank: null,
        priorState: "previously_undrafted",
      })),
      preferences: [
        preference({ user: "a1", winner: 1, loser: 2 }),
        preference({ user: "a2", winner: 1, loser: 2 }),
        preference({ user: "b1", winner: 2, loser: 3 }),
        preference({ user: "b2", winner: 2, loser: 4 }),
        preference({ user: "b3", winner: 2, loser: 5 }),
        preference({ user: "c1", winner: 3, loser: 6 }),
        preference({ user: "c2", winner: 4, loser: 6 }),
        preference({ user: "c3", winner: 5, loser: 6 }),
      ],
    });
    const rank = (playerId: number) =>
      result.players.find((row) => row.fhfhPlayerId === playerId)!.modelRank;
    expect(rank(1)).toBeLessThan(rank(2));
    expect(result.converged).toBe(true);
  });

  it("decays the Yahoo market prior to zero at twenty independent users", () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      preference({ user: `u${index}`, winner: 2, loser: 1 }),
    );
    const result = computeCommunityRanking({
      candidates: candidates(2),
      preferences: rows,
    });
    expect(
      result.players.find((row) => row.fhfhPlayerId === 1)?.marketPriorWeight,
    ).toBe(0);
    expect(
      result.players.find((row) => row.fhfhPlayerId === 2)?.marketPriorWeight,
    ).toBe(0);
    expect(result.players[0].fhfhPlayerId).toBe(2);
  });

  it("gives previously undrafted players a neutral prior instead of synthetic ADP", () => {
    const result = computeCommunityRanking({
      candidates: [
        { fhfhPlayerId: 1, marketRank: 1, priorState: "market_ranked" },
        {
          fhfhPlayerId: 2,
          marketRank: null,
          priorState: "previously_undrafted",
        },
      ],
      preferences: [],
    });
    const undrafted = result.players.find((row) => row.fhfhPlayerId === 2)!;
    expect(undrafted.score).toBe(0);
    expect(undrafted.marketRank).toBeNull();
    expect(undrafted.priorState).toBe("previously_undrafted");
    expect(undrafted.marketPriorWeight).toBe(0);
    expect(undrafted.publicTop250Eligible).toBe(false);
  });

  it("distinguishes market-seeded, building, and emerging evidence states", () => {
    const rows: CommunityPairPreference[] = [];
    for (let user = 0; user < 5; user += 1) {
      rows.push(preference({ user: `u${user}`, winner: 2, loser: 3 + user }));
      rows.push(
        preference({
          user: `u${user}`,
          winner: 2,
          loser: 3 + ((user + 1) % 5),
        }),
      );
    }
    rows.push(preference({ user: "one", winner: 5, loser: 6 }));
    const result = computeCommunityRanking({
      candidates: candidates(8),
      preferences: rows,
    });
    const state = (playerId: number) =>
      result.players.find((row) => row.fhfhPlayerId === playerId)!
        .evidenceState;
    expect(state(1)).toBe("market_seeded");
    expect(state(5)).toBe("building");
    expect(state(2)).toBe("emerging");
  });

  it("admits an undrafted entrant only after established diverse cutoff evidence and a buffered top-250 estimate", () => {
    const universe = candidates(300);
    universe[0] = {
      fhfhPlayerId: 1,
      marketRank: null,
      priorState: "previously_undrafted",
    };
    const opponents = [200, 210, 220, 230, 240, 251, 260, 270, 280, 290];
    const rows: CommunityPairPreference[] = [];
    for (let user = 0; user < 20; user += 1) {
      for (const opponent of [
        opponents[user % 10],
        opponents[(user + 5) % 10],
      ]) {
        rows.push(preference({ user: `u${user}`, winner: 1, loser: opponent }));
      }
    }
    const result = computeCommunityRanking({
      candidates: universe,
      preferences: rows,
    });
    const entrant = result.players.find((row) => row.fhfhPlayerId === 1)!;
    expect(entrant.independentUsers).toBe(20);
    expect(entrant.comparisonCount).toBe(40);
    expect(entrant.distinctOpponents).toBe(10);
    expect(entrant.evidenceState).toBe("established");
    expect(entrant.publicTop250Eligible).toBe(true);
    expect(entrant.admissionBasis).toBe("community_evidence");
  });
});

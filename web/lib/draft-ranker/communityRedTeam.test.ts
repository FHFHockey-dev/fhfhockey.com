import { describe, expect, it } from "vitest";

import {
  computeCommunityRanking,
  type CommunityCandidate,
  type CommunityPairPreference,
} from "./communityModel";

function universe(): CommunityCandidate[] {
  return Array.from({ length: 300 }, (_, index) => ({
    fhfhPlayerId: index + 1,
    marketRank: index === 0 ? null : index + 1,
    priorState:
      index === 0
        ? ("previously_undrafted" as const)
        : ("market_ranked" as const),
  }));
}

function comparison(args: {
  user: string;
  winner: number;
  loser: number;
  sequence: number;
  consentActive?: boolean;
  rateEligible?: boolean;
  moderationExcluded?: boolean;
}): CommunityPairPreference {
  return {
    comparisonId: `red-team-${args.sequence}`,
    userKey: args.user,
    lowPlayerId: Math.min(args.winner, args.loser),
    highPlayerId: Math.max(args.winner, args.loser),
    preferredPlayerId: args.winner,
    establishedAt: new Date(
      Date.UTC(2026, 6, 1) + args.sequence * 1_000,
    ).toISOString(),
    communityEligible: true,
    consentActive: args.consentActive ?? true,
    rateEligible: args.rateEligible ?? true,
    moderationExcluded: args.moderationExcluded ?? false,
  };
}

function qualifyingCutoffEvidence(
  overrides: Pick<
    CommunityPairPreference,
    "consentActive" | "rateEligible" | "moderationExcluded"
  > = {},
): CommunityPairPreference[] {
  const opponents = [200, 210, 220, 230, 240, 251, 260, 270, 280, 290];
  const rows: CommunityPairPreference[] = [];
  let sequence = 1;
  for (let user = 0; user < 20; user += 1) {
    for (const opponent of [
      opponents[user % opponents.length],
      opponents[(user + 5) % opponents.length],
    ]) {
      rows.push(
        comparison({
          user: `account-${user}`,
          winner: 1,
          loser: opponent,
          sequence,
          ...overrides,
        }),
      );
      sequence += 1;
    }
  }
  return rows;
}

function entrant(rows: CommunityPairPreference[]) {
  return computeCommunityRanking({
    candidates: universe(),
    preferences: rows,
  }).players.find((player) => player.fhfhPlayerId === 1)!;
}

describe("Community Ranking v1 red-team calibration", () => {
  it("collapses a one-account duplicate flood to one effective pair", () => {
    const rows = Array.from({ length: 200 }, (_, index) =>
      comparison({
        user: "single-account",
        winner: index % 2 ? 2 : 1,
        loser: index % 2 ? 1 : 2,
        sequence: index + 1,
      }),
    );
    const result = computeCommunityRanking({
      candidates: universe(),
      preferences: rows,
    });
    const target = result.players.find((player) => player.fhfhPlayerId === 1)!;
    expect(result.acceptedComparisonCount).toBe(1);
    expect(result.deduplicatedComparisonCount).toBe(199);
    expect(target.evidenceState).toBe("building");
    expect(target.publicTop250Eligible).toBe(false);
  });

  it("does not treat a high-user but one-opponent sparse graph as established", () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      comparison({
        user: `sparse-${index}`,
        winner: 1,
        loser: 251,
        sequence: index + 1,
      }),
    );
    const target = entrant(rows);
    expect(target.independentUsers).toBe(25);
    expect(target.distinctOpponents).toBe(1);
    expect(target.evidenceState).toBe("building");
    expect(target.admissionBasis).toBeNull();
  });

  it("rebuilds without opted-out evidence instead of preserving its prior effect", () => {
    const accepted = qualifyingCutoffEvidence();
    const before = entrant(accepted);
    const after = entrant(
      accepted.map((row) => ({ ...row, consentActive: false })),
    );
    expect(before.evidenceState).toBe("established");
    expect(before.admissionBasis).toBe("community_evidence");
    expect(after.comparisonCount).toBe(0);
    expect(after.publicTop250Eligible).toBe(false);
  });

  it("excludes a rate-suppressed burst before model fitting", () => {
    const rows = qualifyingCutoffEvidence({ rateEligible: false });
    const result = computeCommunityRanking({
      candidates: universe(),
      preferences: rows,
    });
    expect(result.acceptedComparisonCount).toBe(0);
    expect(result.excludedComparisonCount).toBe(rows.length);
    expect(entrant(rows).publicTop250Eligible).toBe(false);
  });

  it("requires evidence on both sides of the cutoff", () => {
    const opponents = [200, 205, 210, 215, 220, 225, 230, 235, 240, 245];
    const rows: CommunityPairPreference[] = [];
    let sequence = 1;
    for (let user = 0; user < 20; user += 1) {
      for (const opponent of [
        opponents[user % 10],
        opponents[(user + 1) % 10],
      ]) {
        rows.push(
          comparison({
            user: `one-side-${user}`,
            winner: 1,
            loser: opponent,
            sequence,
          }),
        );
        sequence += 1;
      }
    }
    const target = entrant(rows);
    expect(target.independentUsers).toBe(20);
    expect(target.comparisonCount).toBe(40);
    expect(target.distinctOpponents).toBe(10);
    expect(target.cutoffOpponentsOutside).toBe(0);
    expect(target.evidenceState).toBe("emerging");
    expect(target.publicTop250Eligible).toBe(false);
  });

  it("removes a coordinated cohort once moderation excludes its evidence", () => {
    const coordinated = qualifyingCutoffEvidence();
    const excluded = coordinated.map((row) => ({
      ...row,
      moderationExcluded: true,
    }));
    expect(entrant(coordinated).admissionBasis).toBe("community_evidence");
    expect(entrant(excluded).admissionBasis).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  buildDeterministicDraftPairQueue,
  canonicalPairKey,
  type DraftPairQueuePlayer,
} from "./queue";

function players(): DraftPairQueuePlayer[] {
  return Array.from({ length: 275 }, (_, index) => {
    const rank = index + 1;
    const position = rank % 11 === 0 ? "G" : rank % 4 === 0 ? "D" : "C";
    return {
      playerId: 10_000 + rank,
      rank,
      position,
      lifecycleStatus:
        rank === 252 || rank === 258 ? "active_prospect" : "active_nhl",
      seedAdp: rank <= 260 ? rank + 0.5 : null,
      watched: rank === 251 || rank === 255,
    };
  });
}

describe("deterministic Draft Ranker pair queue", () => {
  it("builds the approved twenty-slot launch mix deterministically", () => {
    const input = {
      players: players(),
      preferences: [],
      recentPairKeys: new Set<string>(),
      mode: "improve_ranking" as const,
      now: new Date("2026-07-15T00:00:00Z"),
    };
    const first = buildDeterministicDraftPairQueue(input);
    const second = buildDeterministicDraftPairQueue(input);

    expect(second).toEqual(first);
    expect(first).toHaveLength(20);
    expect(first.filter((item) => item.category === "personal")).toHaveLength(10);
    expect(first.filter((item) => item.category === "discovery")).toHaveLength(5);
    expect(first.filter((item) => item.category === "validation")).toHaveLength(3);
    expect(first.filter((item) => item.category === "editorial")).toHaveLength(2);
    expect(new Set(first.map((item) => canonicalPairKey(item.playerAId, item.playerBId))).size).toBe(20);
    for (let index = 3; index < first.length; index += 1) {
      const groups = first.slice(index - 3, index + 1).map((item) => item.focusPosition);
      expect(
        groups[0] !== "mixed" && groups.every((group) => group === groups[0]),
      ).toBe(false);
    }
  });

  it("enforces the thirty-prompt or seven-day cooldown", () => {
    const baseline = buildDeterministicDraftPairQueue({
      players: players(),
      preferences: [],
      recentPairKeys: new Set(),
      mode: "improve_ranking",
    });
    const blocked = canonicalPairKey(
      baseline[0].playerAId,
      baseline[0].playerBId,
    );
    const next = buildDeterministicDraftPairQueue({
      players: players(),
      preferences: [],
      recentPairKeys: new Set([blocked]),
      mode: "improve_ranking",
    });
    expect(next.map((item) => canonicalPairKey(item.playerAId, item.playerBId))).not.toContain(blocked);
  });

  it("allows explicit contradiction revalidation despite ordinary cooldown", () => {
    const preference = {
      lowPlayerId: 10_100,
      highPlayerId: 10_101,
      preferredPlayerId: 10_101,
      establishedAt: "2026-07-14T00:00:00Z",
    };
    const key = canonicalPairKey(preference.lowPlayerId, preference.highPlayerId);
    const queue = buildDeterministicDraftPairQueue({
      players: players(),
      preferences: [preference],
      recentPairKeys: new Set([key]),
      mode: "resolve_close_calls",
      now: new Date("2026-07-15T00:00:00Z"),
    });
    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "direct_edit_contradiction",
          allowRecentRepeat: true,
        }),
      ]),
    );
  });

  it("supports a bounded quick-five and goalie-only mode", () => {
    const quick = buildDeterministicDraftPairQueue({
      players: players(), preferences: [], recentPairKeys: new Set(), mode: "quick_five",
    });
    const goalies = buildDeterministicDraftPairQueue({
      players: players(), preferences: [], recentPairKeys: new Set(), mode: "review_goalies",
    });
    expect(quick).toHaveLength(5);
    expect(goalies.length).toBeGreaterThan(0);
    expect(goalies.every((item) => item.focusPosition === "G")).toBe(true);
  });

  it("includes goalie and defense discovery when eligible", () => {
    const discovery = buildDeterministicDraftPairQueue({
      players: players(), preferences: [], recentPairKeys: new Set(), mode: "find_sleepers",
    }).filter((item) => item.category === "discovery" || item.category === "editorial");
    expect(discovery.some((item) => item.focusPosition === "G")).toBe(true);
    expect(discovery.some((item) => item.focusPosition === "D")).toBe(true);
  });
});

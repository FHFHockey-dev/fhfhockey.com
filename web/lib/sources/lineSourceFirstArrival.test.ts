import { describe, expect, it } from "vitest";

import {
  buildFirstArrivalBucketKey,
  selectFirstArrivalBuckets,
  type FirstArrivalCandidate,
} from "./lineSourceFirstArrival";

function candidate(
  overrides: Partial<FirstArrivalCandidate<string>> = {},
): FirstArrivalCandidate<string> {
  return {
    value: overrides.value ?? "row",
    captureKey: overrides.captureKey ?? "capture-1",
    sourceKey: overrides.sourceKey ?? "ccc",
    tweetId: overrides.tweetId ?? "100",
    snapshotDate: overrides.snapshotDate ?? "2026-07-11",
    teamId: overrides.teamId ?? 1,
    teamAbbreviation: overrides.teamAbbreviation ?? "BOS",
    gameId: overrides.gameId ?? 42,
    signalType: overrides.signalType ?? "lineup",
    signalSubtype: overrides.signalSubtype ?? null,
    tweetPostedAt: overrides.tweetPostedAt ?? "2026-07-11T12:00:00.000Z",
    observedAt: overrides.observedAt ?? "2026-07-11T12:01:00.000Z",
    status: overrides.status ?? "observed",
    nhlFilterStatus: overrides.nhlFilterStatus ?? "accepted",
  };
}

describe("line source first-arrival selection", () => {
  it("groups by date, team, game, signal, and subtype", () => {
    expect(buildFirstArrivalBucketKey(candidate())).toBe(
      "2026-07-11|team:1|game:42|lineup|none",
    );
    expect(
      buildFirstArrivalBucketKey(candidate({ signalSubtype: "confirmed" })),
    ).not.toBe(buildFirstArrivalBucketKey(candidate()));
  });

  it("uses posted time first and observed time only as fallback", () => {
    const buckets = selectFirstArrivalBuckets([
      candidate({
        value: "observed-earlier",
        sourceKey: "ccc",
        tweetPostedAt: "2026-07-11T12:05:00.000Z",
        observedAt: "2026-07-11T11:55:00.000Z",
      }),
      candidate({
        value: "posted-earlier",
        sourceKey: "gamedaylines",
        captureKey: "capture-2",
        tweetId: "101",
        tweetPostedAt: "2026-07-11T12:00:00.000Z",
        observedAt: "2026-07-11T12:10:00.000Z",
      }),
    ]);

    expect(buckets[0]?.winner.value).toBe("posted-earlier");
    expect(buckets[0]?.nonWinners.map((row) => row.value)).toEqual([
      "observed-earlier",
    ]);
  });

  it("uses deterministic source, tweet, and capture tie-breakers", () => {
    const buckets = selectFirstArrivalBuckets([
      candidate({
        value: "gdl",
        sourceKey: "gamedaylines",
        captureKey: "capture-2",
        tweetId: "200",
      }),
      candidate({ value: "ccc", sourceKey: "ccc", tweetId: "300" }),
    ]);

    expect(buckets[0]?.winner.value).toBe("ccc");
  });

  it("excludes rejected and non-observed rows from winner buckets", () => {
    const buckets = selectFirstArrivalBuckets([
      candidate({ value: "accepted" }),
      candidate({
        value: "rejected",
        captureKey: "capture-2",
        status: "rejected",
        nhlFilterStatus: "rejected_ambiguous",
      }),
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.winner.value).toBe("accepted");
    expect(buckets[0]?.nonWinners).toEqual([]);
  });
});

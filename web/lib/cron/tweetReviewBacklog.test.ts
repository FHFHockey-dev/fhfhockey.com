import { describe, expect, it } from "vitest";
import { buildTweetBacklog, countDistinctNames, parseBacklogSnapshot, snapshotCounts } from "./tweetReviewBacklog";

const today = {
  trainer: { line_combination: 1400, goalie: 1830, injury: 644, transaction: 192 },
  answerKeyLabels: 0,
  unresolvedRows: 1211,
  unresolvedNames: 655,
};

describe("buildTweetBacklog", () => {
  it("shows each count with its change since the previous snapshot", () => {
    const backlog = buildTweetBacklog({
      snapshotDate: "2026-11-07",
      current: today,
      previous: { snapshotDate: "2026-11-06", counts: { ...today, trainer: { ...today.trainer, goalie: 1900 }, answerKeyLabels: 0, unresolvedRows: 1200 } },
    });
    expect(backlog.status).toBe("ok");
    expect(backlog.previousDate).toBe("2026-11-06");
    expect(backlog.queue.map((entry) => [entry.label, entry.count, entry.delta])).toEqual([
      ["Line combos", 1400, 0], ["Goalies", 1830, -70], ["Injuries", 644, 0], ["Transactions", 192, 0],
    ]);
    expect(backlog.unresolvedRows).toMatchObject({ count: 1211, previous: 1200, delta: 11 });
    expect(snapshotCounts(backlog)).toEqual(today);
  });

  it("leaves changes blank without a snapshot and stores nothing when a count is unknown", () => {
    const backlog = buildTweetBacklog({ snapshotDate: "2026-11-06", current: { ...today, unresolvedNames: undefined }, previous: null, warnings: ["x"] });
    expect(backlog.status).toBe("partial");
    expect(backlog.queue[0]).toMatchObject({ count: 1400, previous: null, delta: null });
    expect(backlog.unresolvedNames.count).toBeNull();
    expect(backlog.warnings).toEqual(["x"]);
    expect(snapshotCounts(backlog)).toBeNull();
    expect(buildTweetBacklog({ snapshotDate: "2026-11-06", current: {}, previous: null }).status).toBe("unknown");
  });
});

describe("parseBacklogSnapshot", () => {
  it("round-trips stored counts and rejects other shapes", () => {
    expect(parseBacklogSnapshot(JSON.parse(JSON.stringify(today)))).toEqual(today);
    expect(parseBacklogSnapshot({ ...today, unresolvedRows: -1 })).toBeNull();
    expect(parseBacklogSnapshot({ answerKeyLabels: 0 })).toBeNull();
    expect(parseBacklogSnapshot(null)).toBeNull();
  });
});

describe("countDistinctNames", () => {
  it("counts by normalised name, falling back to the raw name", () => {
    expect(countDistinctNames([
      { normalized_name: "matvei michkov", raw_name: "Michkov" },
      { normalized_name: "matvei michkov", raw_name: "M. Michkov" },
      { normalized_name: null, raw_name: " Zegras " },
      { normalized_name: "", raw_name: "zegras" },
      { normalized_name: null, raw_name: null },
    ])).toBe(2);
  });
});

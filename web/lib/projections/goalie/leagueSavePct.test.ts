import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ count: 0 }));

vi.mock("lib/supabase/server", () => {
  const rows = [
    { game_date: "2025-12-01", shots_against: 30, goals_allowed: 3 },
    { game_date: "2026-10-10", shots_against: 28, goals_allowed: 2 },
  ];
  const builder: any = {
    select: () => builder,
    gte: () => builder,
    lt: () => builder,
    order: () => builder,
    range: async () => {
      reads.count += 1;
      return { data: rows, error: null };
    },
  };
  return { default: { from: () => builder } };
});

import { getSeasonLeagueSavePct, type SeasonLeagueSavePctCache } from "./leagueSavePct";

describe("getSeasonLeagueSavePct", () => {
  beforeEach(() => {
    reads.count = 0;
  });

  it("reads once per run and as-of date, reusing the run's cache", async () => {
    const runCache: SeasonLeagueSavePctCache = new Map();
    const first = await getSeasonLeagueSavePct("2026-10-22", runCache);
    const second = await getSeasonLeagueSavePct("2026-10-22", runCache);
    expect(second).toBe(first);
    expect(first.source).toBe("observed");
    expect(reads.count).toBe(1);
  });

  it("reads again in a new run for the same date, so every run records its own input", async () => {
    await getSeasonLeagueSavePct("2026-10-22", new Map());
    await getSeasonLeagueSavePct("2026-10-22", new Map());
    expect(reads.count).toBe(2);
  });
});

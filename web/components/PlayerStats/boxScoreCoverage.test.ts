import { describe, expect, it, vi } from "vitest";

import {
  COVERAGE_DATE_CHUNK,
  fetchTeamBoxScoreDates,
  resolveSeasonTeamId
} from "./boxScoreCoverage";

type Call = { table: string; filters: Array<[string, ...unknown[]]> };

function fakeClient(
  respond: (call: Call) => { data: Array<{ date: string }> | null; error: unknown }
) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, filters: [] };
      calls.push(call);
      const builder: any = {};
      for (const method of ["select", "eq", "in", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          call.filters.push([method, ...args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(respond(call)).then(resolve);
      return builder;
    })
  };
  return { client, calls };
}

const datesOf = (call: Call) =>
  call.filters.find(([method]) => method === "in")?.[2] as string[];

describe("fetchTeamBoxScoreDates", () => {
  it("reads a season of dates in small, team-scoped, bounded chunks", async () => {
    const dates = Array.from({ length: 20 }, (_, i) =>
      `2018-10-${String(i + 1).padStart(2, "0")}`
    );
    const { client, calls } = fakeClient((call) => ({
      data: datesOf(call)
        .filter((date) => date !== "2018-10-05")
        .map((date) => ({ date })),
      error: null
    }));

    const covered = await fetchTeamBoxScoreDates(
      client,
      "wgo_skater_stats",
      "team_abbrev",
      "MIN",
      [...dates, dates[0]]
    );

    expect(calls).toHaveLength(Math.ceil(20 / COVERAGE_DATE_CHUNK));
    for (const call of calls) {
      expect(call.table).toBe("wgo_skater_stats");
      expect(call.filters).toContainEqual(["eq", "team_abbrev", "MIN"]);
      expect(datesOf(call).length).toBeLessThanOrEqual(COVERAGE_DATE_CHUNK);
      const limit = call.filters.find(([method]) => method === "limit")?.[1];
      expect(limit).toBe(datesOf(call).length * 40);
    }
    expect(calls.flatMap(datesOf)).toEqual(dates);
    expect(covered?.size).toBe(19);
    expect(covered?.has("2018-10-05")).toBe(false);
  });

  it("stops at the first failed chunk and reports unknown coverage", async () => {
    const dates = Array.from({ length: 24 }, (_, i) =>
      `2026-01-${String(i + 1).padStart(2, "0")}`
    );
    const { client, calls } = fakeClient(() => ({
      data: null,
      error: { message: "canceling statement due to statement timeout" }
    }));

    await expect(
      fetchTeamBoxScoreDates(client, "wgo_skater_stats", "team_abbrev", "TBL", dates)
    ).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("skips the read without a team or dates", async () => {
    const { client, calls } = fakeClient(() => ({ data: [], error: null }));
    await expect(
      fetchTeamBoxScoreDates(client, "wgo_skater_stats", "team_abbrev", undefined, ["2026-01-01"])
    ).resolves.toBeNull();
    await expect(
      fetchTeamBoxScoreDates(client, "wgo_skater_stats", "team_abbrev", "TBL", [])
    ).resolves.toEqual(new Set());
    expect(calls).toHaveLength(0);
  });
});

describe("resolveSeasonTeamId", () => {
  it("keeps the current team when the season log is empty or includes it", () => {
    expect(resolveSeasonTeamId(30, "MIN", [])).toBe(30);
    expect(resolveSeasonTeamId(30, "MIN", ["DAL", "MIN"])).toBe(30);
  });

  it("uses the one other team a past season was spent with", () => {
    expect(resolveSeasonTeamId(30, "MIN", ["TBL", "TBL", null])).toBe(14);
  });

  it("returns null when a past season spans other teams", () => {
    expect(resolveSeasonTeamId(30, "MIN", ["TBL", "DAL"])).toBeNull();
  });
});

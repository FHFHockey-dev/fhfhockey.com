import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = [operation: string, ...args: unknown[]];

type QueryTrace = {
  table: string;
  calls: QueryCall[];
};

const { fromMock, queryTraces } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  queryTraces: [] as QueryTrace[],
}));

vi.mock("lib/supabase", () => ({
  default: { from: fromMock },
}));

import type { WigoCareerRow, WigoRecentRow } from "./fetchWigoPlayerStats";
import {
  buildPlayerAggregatedStats,
  fetchPlayerGameLogForStat,
} from "./fetchWigoPlayerStats";

function installGameLogQueryMock(rows: Record<string, unknown>[]) {
  fromMock.mockImplementation((table: string) => {
    const trace: QueryTrace = { table, calls: [] };
    queryTraces.push(trace);

    const builder: any = {
      select(...selectArgs: unknown[]) {
        trace.calls.push(["select", ...selectArgs]);
        return builder;
      },
      eq(...eqArgs: unknown[]) {
        trace.calls.push(["eq", ...eqArgs]);
        return builder;
      },
      order(...orderArgs: unknown[]) {
        trace.calls.push(["order", ...orderArgs]);
        return builder;
      },
      then(
        onFulfilled: (value: unknown) => unknown,
        onRejected?: () => unknown,
      ) {
        return Promise.resolve({ data: rows, error: null }).then(
          onFulfilled,
          onRejected,
        );
      },
    };

    return builder;
  });
}

beforeEach(() => {
  fromMock.mockReset();
  queryTraces.length = 0;
});

describe("buildPlayerAggregatedStats", () => {
  it("normalizes aggregate values using the shared stat contract", () => {
    const careerData = {
      player_id: 1,
      std_gp: 20,
      ly_gp: 10,
      ya3_gp: 30,
      ca_gp: 40,
      std_g: 10,
      std_s_pct: 0.15,
      std_ipp: 0.55,
      std_atoi: 15.5,
      std_pptoi: 75,
      std_ixg: 8.44,
    } as WigoCareerRow;

    const recentData = {
      player_id: 1,
      l5_gp: 5,
      l10_gp: 10,
      l20_gp: 20,
      l5_atoi: 17.25,
      l5_pptoi: 50,
      l5_s_pct: 0.2,
      l5_ipp: 0.5,
    } as WigoRecentRow;

    const rows = buildPlayerAggregatedStats({
      careerData,
      recentData,
      ratesData: null,
      totalsData: null,
    });

    expect(rows.find((row) => row.label === "Goals")?.STD).toBe(10);
    expect(rows.find((row) => row.label === "S%")?.STD).toBeCloseTo(15);
    expect(rows.find((row) => row.label === "IPP")?.STD).toBeCloseTo(55);
    expect(rows.find((row) => row.label === "ATOI")?.STD).toBeCloseTo(930);
    expect(rows.find((row) => row.label === "ATOI")?.L5).toBeCloseTo(1035);
    expect(rows.find((row) => row.label === "PPTOI")?.STD).toBeCloseTo(75);
    expect(rows.find((row) => row.label === "PPTOI")?.L5).toBeCloseTo(50);
    expect(rows.find((row) => row.label === "ixG")?.STD).toBeCloseTo(8.44);
  });

  it("derives per-60 values from counts and ATOI when the rates table is missing", () => {
    const careerData = {
      player_id: 1,
      std_gp: 20,
      std_pts: 10,
      std_atoi: 15,
    } as WigoCareerRow;

    const rows = buildPlayerAggregatedStats({
      careerData,
      recentData: null,
      ratesData: null,
      totalsData: null,
    });

    expect(rows.find((row) => row.label === "PTS/60")?.STD).toBeCloseTo(2);
  });

  it("uses totals fallback for missing standard count values", () => {
    const careerData = {
      player_id: 1,
      std_gp: 40,
    } as WigoCareerRow;

    const rows = buildPlayerAggregatedStats({
      careerData,
      recentData: null,
      ratesData: null,
      totalsData: {
        goals: 14,
        assists: 20,
        points: 34,
        shots: 100,
        hits: 50,
        blocked_shots: 25,
        penalty_minutes: 18,
        pp_points: 10,
      },
    });

    expect(rows.find((row) => row.label === "Goals")?.STD).toBe(14);
    expect(rows.find((row) => row.label === "Points")?.STD).toBe(34);
    expect(rows.find((row) => row.label === "PPP")?.STD).toBe(10);
  });
});

describe("fetchPlayerGameLogForStat query contract", () => {
  it("uses numeric season_id and date for WGO game logs", async () => {
    installGameLogQueryMock([{ date: "2026-01-01", goals: 2 }]);

    await expect(
      fetchPlayerGameLogForStat(8478402, 20252026, "Goals"),
    ).resolves.toEqual([{ date: "2026-01-01", value: 2 }]);

    expect(queryTraces).toEqual([
      {
        table: "wgo_skater_stats",
        calls: [
          ["select", "date, goals"],
          ["eq", "player_id", 8478402],
          ["eq", "season_id", 20252026],
          ["order", "date", { ascending: true }],
        ],
      },
    ]);
  });

  it("uses the numeric season column and date_scraped for NST game logs", async () => {
    installGameLogQueryMock([{ date_scraped: "2026-01-02", ixg: 0.42 }]);

    await expect(
      fetchPlayerGameLogForStat(8478402, 20252026, "ixG"),
    ).resolves.toEqual([{ date: "2026-01-02", value: 0.42 }]);

    expect(queryTraces).toEqual([
      {
        table: "nst_gamelog_as_counts",
        calls: [
          ["select", "date_scraped, ixg"],
          ["eq", "player_id", 8478402],
          ["eq", "season", 20252026],
          ["order", "date_scraped", { ascending: true }],
        ],
      },
    ]);
  });
});
